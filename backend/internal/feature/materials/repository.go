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

const materialCols = `id, user_id, notebook_id, conversation_id, type, title, content, created_at`
const attemptCols = `id, material_id, user_id, started_at, submitted_at, score, answers`

// Insert only accepts a notebook the user belongs to and a conversation they own, so
// a generated material cannot be filed into somebody else's notebook or thread. Same
// shape as events.Repository.Create: the checks ride in the INSERT.
func (r *Repository) Insert(ctx context.Context, userID uuid.UUID, notebookID, convID *uuid.UUID, mType, title string, content json.RawMessage) (*Material, error) {
	rows, err := r.pool.Query(ctx,
		`insert into materials (user_id, notebook_id, conversation_id, type, title, content)
		 select $1, $2, $3, $4, $5, $6
		 where ($2::uuid is null
		     or exists(select 1 from notebook_members m where m.notebook_id = $2 and m.user_id = $1))
		   and ($3::uuid is null
		     or exists(select 1 from conversations c where c.id = $3 and c.user_id = $1))
		 returning `+materialCols,
		userID, notebookID, convID, mType, title, content)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Material](rows)
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID, notebookID *uuid.UUID, mType *string, c *page.Cursor, limit int) ([]Material, string, error) {
	ct, cid := c.Args()
	rows, err := r.pool.Query(ctx,
		`select `+materialCols+` from materials
		 where user_id = $1
		   and ($2::uuid is null or notebook_id = $2)
		   and ($3::text is null or type = $3)
		   and ($4::timestamptz is null or (created_at, id) < ($4, $5))
		 order by created_at desc, id desc
		 limit $6`,
		userID, notebookID, mType, ct, cid, limit+1)
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
