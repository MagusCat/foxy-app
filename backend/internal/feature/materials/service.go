package materials

import (
	"context"

	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/page"
	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
	ai   *aiclient.Client
}

func NewService(repo *Repository, ai *aiclient.Client) *Service {
	return &Service{repo: repo, ai: ai}
}

// Generate requests the material from the AI and persists it.
func (s *Service) Generate(ctx context.Context, userID uuid.UUID, req GenerateRequest) (*Material, error) {
	content, err := s.ai.Generate(ctx, aiclient.GenerateRequest{
		Type:   req.Type,
		Prompt: req.Prompt,
	})
	if err != nil {
		return nil, err
	}
	title := defaultTitle(req.Type)
	if req.Title != nil && *req.Title != "" {
		title = *req.Title
	}
	return s.repo.Insert(ctx, userID, req.ZoneID, req.ConversationID, req.Type, title, content)
}

func (s *Service) List(ctx context.Context, userID uuid.UUID, zoneID *uuid.UUID, mType *string, rawCursor string, limit int) ([]Material, string, error) {
	c, err := page.Decode(rawCursor)
	if err != nil {
		return nil, "", err
	}
	return s.repo.List(ctx, userID, zoneID, mType, c, limit)
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
