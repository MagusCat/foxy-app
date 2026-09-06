package materials

import (
	"context"
	"log/slog"

	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/page"
	"github.com/google/uuid"
)

// AttachmentsFunc yields the attachment ids whose text the AI may search. It's
// injected from main so materials isn't coupled to the attachments module.
type AttachmentsFunc func(ctx context.Context, userID uuid.UUID, notebookID, convID *uuid.UUID) ([]uuid.UUID, error)

type Service struct {
	repo        *Repository
	ai          *aiclient.Client
	attachments AttachmentsFunc
}

func NewService(repo *Repository, ai *aiclient.Client, attachments AttachmentsFunc) *Service {
	return &Service{repo: repo, ai: ai, attachments: attachments}
}

// Generate requests the material from the AI and persists it.
func (s *Service) Generate(ctx context.Context, userID uuid.UUID, req GenerateRequest) (*Material, error) {
	content, err := s.ai.Generate(ctx, aiclient.GenerateRequest{
		Type:      req.Type,
		Prompt:    req.Prompt,
		Retrieval: aiclient.Retrieval{AttachmentIDs: s.searchableAttachments(ctx, userID, req)},
	})
	if err != nil {
		return nil, err
	}
	title := defaultTitle(req.Type)
	if req.Title != nil && *req.Title != "" {
		title = *req.Title
	}
	return s.repo.Insert(ctx, userID, req.NotebookID, req.ConversationID, req.Type, title, content)
}

// searchableAttachments never fails the generation: without document context the
// material comes out generic, which beats an error.
func (s *Service) searchableAttachments(ctx context.Context, userID uuid.UUID, req GenerateRequest) []uuid.UUID {
	if s.attachments == nil {
		return nil
	}
	ids, err := s.attachments(ctx, userID, req.NotebookID, req.ConversationID)
	if err != nil {
		slog.ErrorContext(ctx, "could not list the attachments for the context", "error", err)
		return nil
	}
	return ids
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, notebookID *uuid.UUID, mType *string, rawCursor string, limit int) ([]Material, string, error) {
	c, err := page.Decode(rawCursor)
	if err != nil {
		return nil, "", err
	}
	return s.repo.List(ctx, userID, notebookID, mType, c, limit)
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*Material, error) {
	return s.repo.Get(ctx, userID, id)
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.Delete(ctx, userID, id)
}

func (s *Service) StartAttempt(ctx context.Context, userID, materialID uuid.UUID) (*Attempt, error) {
	return s.repo.StartAttempt(ctx, userID, materialID)
}

func (s *Service) SubmitAttempt(ctx context.Context, userID, attemptID uuid.UUID, req SubmitAttemptRequest) (*Attempt, error) {
	return s.repo.SubmitAttempt(ctx, userID, attemptID, req.Answers, req.Score)
}

func (s *Service) ListAttempts(ctx context.Context, userID, materialID uuid.UUID) ([]Attempt, error) {
	return s.repo.ListAttempts(ctx, userID, materialID)
}
