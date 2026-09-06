package zones

import (
	"context"
	crand "crypto/rand"
	"errors"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service { return &Service{repo: repo} }

const (
	pgUniqueViolation = "23505" // Postgres unique_violation SQLSTATE
	joinCodeRetries   = 5       // attempts to find a free join code before giving up
	joinCodeLen       = 6       // characters in a join code
)

func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]Zone, error) {
	return s.repo.List(ctx, userID)
}

// Create generates a unique join code when the zone is collaborative, retrying if
// it collides with an existing one (extremely rare with 32^6 combinations).
func (s *Service) Create(ctx context.Context, userID uuid.UUID, req CreateZoneRequest) (*Zone, error) {
	for attempt := 0; attempt < joinCodeRetries; attempt++ {
		var code *string
		if req.IsCollaborative {
			c := genCode()
			code = &c
		}
		z, err := s.repo.Create(ctx, userID, req, code)
		if err == nil {
			return z, nil
		}
		var pgErr *pgconn.PgError
		if req.IsCollaborative && errors.As(err, &pgErr) && pgErr.Code == pgUniqueViolation {
			continue // duplicate join_code: retry with another
		}
		return nil, err
	}
	return nil, apperr.Internal(errors.New("could not generate a unique join code"))
}

func (s *Service) Get(ctx context.Context, userID, zoneID uuid.UUID) (*Zone, error) {
	return s.repo.Get(ctx, userID, zoneID)
}

func (s *Service) Update(ctx context.Context, userID, zoneID uuid.UUID, req UpdateZoneRequest) (*Zone, error) {
	return s.repo.Update(ctx, userID, zoneID, req)
}

func (s *Service) Delete(ctx context.Context, userID, zoneID uuid.UUID) error {
	return s.repo.Delete(ctx, userID, zoneID)
}

func (s *Service) Join(ctx context.Context, userID uuid.UUID, code string) (*Zone, error) {
	return s.repo.JoinByCode(ctx, userID, code)
}

func (s *Service) Leave(ctx context.Context, userID, zoneID uuid.UUID) error {
	return s.repo.Leave(ctx, userID, zoneID)
}

func (s *Service) Members(ctx context.Context, userID, zoneID uuid.UUID) ([]Member, error) {
	return s.repo.Members(ctx, userID, zoneID)
}

func (s *Service) ListObjectives(ctx context.Context, userID, zoneID uuid.UUID) ([]Objective, error) {
	return s.repo.ListObjectives(ctx, userID, zoneID)
}

func (s *Service) CreateObjective(ctx context.Context, userID, zoneID uuid.UUID, req CreateObjectiveRequest) (*Objective, error) {
	return s.repo.CreateObjective(ctx, userID, zoneID, req)
}

func (s *Service) UpdateObjective(ctx context.Context, userID, objID uuid.UUID, req UpdateObjectiveRequest) (*Objective, error) {
	return s.repo.UpdateObjective(ctx, userID, objID, req)
}

func (s *Service) DeleteObjective(ctx context.Context, userID, objID uuid.UUID) error {
	return s.repo.DeleteObjective(ctx, userID, objID)
}

func (s *Service) SetProgress(ctx context.Context, userID, objID uuid.UUID, pct int) (*Progress, error) {
	return s.repo.SetProgress(ctx, userID, objID, pct)
}

// genCode: 6 characters from an alphabet without I/O/0/1 (avoids confusion when
// read aloud). 32 divides 256, so the modulo doesn't bias the choice.
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func genCode() string {
	b := make([]byte, joinCodeLen)
	_, _ = crand.Read(b)
	out := make([]byte, joinCodeLen)
	for i, v := range b {
		out[i] = codeAlphabet[int(v)%len(codeAlphabet)]
	}
	return string(out)
}
