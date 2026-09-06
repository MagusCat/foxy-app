package profile

import (
	"context"
	"log/slog"
	"regexp"
	"strings"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

func (s *Service) Get(ctx context.Context, id uuid.UUID) (*Profile, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) Update(ctx context.Context, id uuid.UUID, req UpdateProfileRequest) (*Profile, error) {
	return s.repo.Update(ctx, id, req)
}

// RecordActivity updates the streak. It's best-effort (chat calls it in a
// goroutine): if it fails, it's logged and that's it, it doesn't break the
// response to the user.
func (s *Service) RecordActivity(ctx context.Context, userID uuid.UUID) {
	if err := s.repo.TouchStreak(ctx, userID); err != nil {
		slog.ErrorContext(ctx, "could not update streak", "user_id", userID, "error", err)
	}
}

func (s *Service) ListProfessions(ctx context.Context) ([]Profession, error) {
	return s.repo.ListProfessions(ctx)
}

func (s *Service) ListSubjects(ctx context.Context, userID uuid.UUID) ([]Subject, error) {
	return s.repo.ListSubjects(ctx, userID)
}

func (s *Service) CreateProfession(ctx context.Context, name string) (*Profession, error) {
	name = strings.TrimSpace(name)
	return s.repo.UpsertProfession(ctx, slugify(name), name)
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

// slugify normalizes the name to a stable key: "Diseñador Gráfico" -> "dise-ador-gr-fico".
func slugify(s string) string {
	s = strings.ToLower(s)
	s = nonSlug.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}
