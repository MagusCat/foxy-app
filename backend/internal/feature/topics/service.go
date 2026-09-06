package topics

import (
	"context"
	"errors"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

const pgUniqueViolation = "23505" // Postgres unique_violation SQLSTATE

// errDupName maps the UNIQUE (notebook_id, name) violation to a 409 instead of a 500.
var errDupName = apperr.Conflict("ya existe un tema con ese nombre en la zona")

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context, userID, notebookID uuid.UUID) ([]Topic, error) {
	return s.repo.List(ctx, userID, notebookID)
}

func (s *Service) Create(ctx context.Context, userID, notebookID uuid.UUID, req CreateTopicRequest) (*Topic, error) {
	t, err := s.repo.Create(ctx, userID, notebookID, req)
	return t, mapDupName(err)
}

func (s *Service) Update(ctx context.Context, userID, topicID uuid.UUID, req UpdateTopicRequest) (*Topic, error) {
	t, err := s.repo.Update(ctx, userID, topicID, req)
	return t, mapDupName(err)
}

func (s *Service) Delete(ctx context.Context, userID, topicID uuid.UUID) error {
	return s.repo.Delete(ctx, userID, topicID)
}

// mapDupName turns a duplicate-name DB error into a clean 409; anything else that
// isn't already an *apperr.Error becomes a 500.
func mapDupName(err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
		return errDupName
	}
	return apperr.As(err)
}
