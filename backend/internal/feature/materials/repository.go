package materials

import (
	"context"
	"encoding/json"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbx"
	"github.com/foxy-app/backend/internal/platform/page"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const materialCols = `id, user_id, zone_id, conversation_id, type, title, content, created_at`
const attemptCols = `id, material_id, user_id, started_at, submitted_at, score, answers`

func (r *Repository) Insert(ctx context.Context, userID uuid.UUID, zoneID, convID *uuid.UUID, mType, title string, content json.RawMessage) (*Material, error) {
	rows, err := r.pool.Query(ctx,
		`insert into materials (user_id, zone_id, conversation_id, type, title, content)
		 values ($1,$2,$3,$4,$5,$6) returning `+materialCols,
		userID, zoneID, convID, mType, title, content)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Material](rows)
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID, zoneID *uuid.UUID, mType *string, c *page.Cursor, limit int) ([]Material, string, error) {
	ct, cid := c.Args()
	rows, err := r.pool.Query(ctx,
		`select `+materialCols+` from materials
		 where user_id = $1
		   and ($2::uuid is null or zone_id = $2)
		   and ($3::text is null or type = $3)
		   and ($4::timestamptz is null or (created_at, id) < ($4, $5))
		 order by created_at desc, id desc
		 limit $6`,
		userID, zoneID, mType, ct, cid, limit+1)
	if err != nil {
		return nil, "", apperr.Internal(err)
	}
	list, err := dbx.Many[Material](rows)
	if err != nil {
		return nil, "", err
	}
	items, next := page.Slice(list, limit, func(m Material) string {
		return page.Encode(m.CreatedAt, m.ID)
	})
	return items, next, nil
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*Material, error) {
	rows, err := r.pool.Query(ctx, `select `+materialCols+` from materials where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Material](rows)
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `delete from materials where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// StartAttempt creates the attempt only if the material belongs to the user.
func (r *Repository) StartAttempt(ctx context.Context, userID, materialID uuid.UUID) (*Attempt, error) {
	rows, err := r.pool.Query(ctx,
		`insert into exam_attempts (material_id, user_id)
		 select $1, $2 where exists(select 1 from materials where id = $1 and user_id = $2)
		 returning `+attemptCols,
		materialID, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Attempt](rows)
}

func (r *Repository) SubmitAttempt(ctx context.Context, userID, attemptID uuid.UUID, answers json.RawMessage, score *float64) (*Attempt, error) {
	rows, err := r.pool.Query(ctx,
		`update exam_attempts set answers = $3, score = $4, submitted_at = now()
		 where id = $1 and user_id = $2 returning `+attemptCols,
		attemptID, userID, answers, score)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Attempt](rows)
}

func (r *Repository) ListAttempts(ctx context.Context, userID, materialID uuid.UUID) ([]Attempt, error) {
	rows, err := r.pool.Query(ctx,
		`select `+attemptCols+` from exam_attempts
		 where user_id = $1 and material_id = $2 order by started_at desc`,
		userID, materialID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Attempt](rows)
}
