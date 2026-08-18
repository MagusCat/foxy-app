package attachments

import (
	"context"
	"log/slog"

	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/storage"
	"github.com/google/uuid"
)

type Service struct {
	repo    *Repository
	storage *storage.Client
	ai      *aiclient.Client
}

func NewService(repo *Repository, st *storage.Client, ai *aiclient.Client) *Service {
	return &Service{repo: repo, storage: st, ai: ai}
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
func (s *Service) Register(ctx context.Context, userID uuid.UUID, req RegisterRequest) (*Attachment, error) {
	a, err := s.repo.Insert(ctx, userID, req)
	if err != nil {
		return nil, err
	}
	go s.extract(a.ID, a.StoragePath)
	return a, nil
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*Attachment, error) {
	return s.repo.Get(ctx, userID, id)
}

// extract runs decoupled from the request (its own context): it asks the
// ai-service for the text and marks the status. A failure leaves the attachment
// as 'failed', it doesn't break anything.
func (s *Service) extract(id uuid.UUID, path string) {
	ctx := context.Background()
	text, err := s.ai.Extract(ctx, path)
	status := statusReady
	if err != nil {
		status = statusFailed
		slog.ErrorContext(ctx, "text extraction failed", "attachment_id", id, "error", err)
	}
	if err := s.repo.SetExtracted(ctx, id, text, status); err != nil {
		slog.ErrorContext(ctx, "could not save extracted text", "attachment_id", id, "error", err)
	}
}
