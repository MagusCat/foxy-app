package attachments

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/foxy-app/backend/internal/platform/storage"
	"github.com/google/uuid"
)

// Extraction runs off the request path, but not unsupervised: `go extract(...)`
// per upload meant one unbounded goroutine per registered file, each holding a
// request against an ai-service that was already busy, and none of them survived
// a deploy — the attachment stayed 'pending' forever, and nothing re-processes a
// 'pending'. These bound it: a fixed set of workers, a queue that pushes back,
// and a Close() that Run waits on.
const (
	extractWorkers   = 4
	extractQueueSize = 64
	extractTimeout   = 5 * time.Minute
)

type extractJob struct {
	id       uuid.UUID
	userID   uuid.UUID // quién subió el archivo; viaja en el token al ai-service
	path     string
	fileName string
}

type Service struct {
	repo    *Repository
	storage *storage.Client
	ai      *aiclient.Client
	jobs    chan extractJob
	wg      sync.WaitGroup
}

func NewService(repo *Repository, st *storage.Client, ai *aiclient.Client) *Service {
	s := &Service{
		repo:    repo,
		storage: st,
		ai:      ai,
		jobs:    make(chan extractJob, extractQueueSize),
	}
	s.wg.Add(extractWorkers)
	for range extractWorkers {
		go s.worker()
	}
	return s
}

// worker drains the queue until Close shuts it down.
func (s *Service) worker() {
	defer s.wg.Done()
	for j := range s.jobs {
		s.extract(j)
	}
}

// Close stops accepting extractions and waits for the ones in flight. The caller
// runs it AFTER http.Server.Shutdown, so no handler can still be enqueueing.
func (s *Service) Close() {
	close(s.jobs)
	s.wg.Wait()
}

type UploadTarget struct {
	UploadURL   string `json:"upload_url"`
	StoragePath string `json:"storage_path"`
}

// CreateUploadURL signs an upload URL. The mobile client uploads the binary there
// and then calls Register with the returned storage_path.
func (s *Service) CreateUploadURL(ctx context.Context, userID uuid.UUID, req UploadURLRequest) (*UploadTarget, error) {
	path := s.storage.NewPath(userID, req.FileName)
	url, err := s.storage.SignUploadURL(ctx, path)
	if err != nil {
		return nil, err
	}
	return &UploadTarget{UploadURL: url, StoragePath: path}, nil
}

// Register saves the metadata and triggers text extraction in the background.
//
// The storage_path comes from the client, so it is checked against the prefix
// this user's paths must have (storage.NewPath: "<userID>/<uuid>/<file>"). Without
// this the caller could register somebody else's object and get it read back:
// the extraction downloads with the Supabase service key, which ignores RLS, and
// the resulting fragments would be searchable as if they were their own.
func (s *Service) Register(ctx context.Context, userID uuid.UUID, req RegisterRequest) (*Attachment, error) {
	if !ownsPath(userID, req.StoragePath) {
		return nil, apperr.ErrForbidden
	}
	a, err := s.repo.Insert(ctx, userID, req)
	if err != nil {
		return nil, err
	}
	// A full queue blocks the request instead of dropping the job: the file is
	// already in Storage and a lost extraction leaves it unsearchable for good.
	select {
	case s.jobs <- extractJob{
		id: a.ID, userID: userID, path: a.StoragePath, fileName: a.FileName,
	}:
	case <-ctx.Done():
		slog.ErrorContext(ctx, "extraction queue full, the attachment stays pending",
			"attachment_id", a.ID)
	}
	return a, nil
}

// ownsPath reports whether the path sits inside this user's prefix, the one
// NewPath builds: "<userID>/<uuid>/<file>". The first segment has to be exactly
// the user id — a plain prefix check would also let through "<userID>-otro/..."
// — and no segment may be "." or ".." so the key cannot describe a walk out of
// the prefix, whatever normalization sits downstream.
func ownsPath(userID uuid.UUID, path string) bool {
	first, rest, ok := strings.Cut(path, "/")
	if !ok || first != userID.String() || rest == "" {
		return false
	}
	for _, segment := range strings.Split(rest, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
	}
	return true
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*Attachment, error) {
	return s.repo.Get(ctx, userID, id)
}

// extract runs decoupled from the request (its own context, with a deadline: an
// ai-service that never answers must not hold a worker forever). It asks for the
// text and marks the status; a failure leaves the attachment 'failed', which
// breaks nothing else.
//
// It retries once because there is no way back: nothing re-extracts a 'failed'
// attachment, so a momentary blip would leave that file unsearchable forever.
func (s *Service) extract(j extractJob) {
	// Contexto propio, desligado de la petición que la encoló, pero con el
	// usuario dentro: es lo que el aiclient firma en el token, y sin él una
	// extracción sería la única llamada al ai-service que no se puede atribuir
	// a nadie.
	ctx, cancel := context.WithTimeout(
		reqctx.WithUser(context.Background(), reqctx.User{ID: j.userID}), extractTimeout)
	defer cancel()

	req := aiclient.ExtractRequest{StoragePath: j.path, AttachmentID: j.id, FileName: j.fileName}
	text, err := s.ai.Extract(ctx, req)
	if err != nil {
		slog.WarnContext(ctx, "text extraction failed, retrying", "attachment_id", j.id, "error", err)
		select {
		case <-time.After(2 * time.Second):
			text, err = s.ai.Extract(ctx, req)
		case <-ctx.Done():
		}
	}
	status := statusReady
	if err != nil {
		status = statusFailed
		slog.ErrorContext(ctx, "text extraction failed", "attachment_id", j.id, "error", err)
	}
	// The write must outlive the extraction deadline, or a timeout would also
	// lose the record of it having timed out.
	saveCtx, saveCancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer saveCancel()
	if err := s.repo.SetExtracted(saveCtx, j.id, text, status); err != nil {
		slog.ErrorContext(saveCtx, "could not save extracted text", "attachment_id", j.id, "error", err)
	}
}
