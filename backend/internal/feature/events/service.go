package events

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context, userID uuid.UUID, from, to *time.Time, zoneID *uuid.UUID) ([]Event, error) {
	return s.repo.List(ctx, userID, from, to, zoneID)
}

func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateEventRequest) (*Event, error) {
	return s.repo.Create(ctx, userID, req)
}

func (s *Service) Get(ctx context.Context, userID, id uuid.UUID) (*Event, error) {
	return s.repo.Get(ctx, userID, id)
}

func (s *Service) Update(ctx context.Context, userID, id uuid.UUID, req UpdateEventRequest) (*Event, error) {
	return s.repo.Update(ctx, userID, id, req)
}

func (s *Service) Delete(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.Delete(ctx, userID, id)
}
