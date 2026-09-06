package topics

import (
	"context"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbx"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const topicCols = `id, notebook_id, name, position, created_at`

// List returns the notebook's topics, but only if the user belongs to the notebook;
// otherwise NotFound (don't reveal a notebook they can't see).
func (r *Repository) List(ctx context.Context, userID, notebookID uuid.UUID) ([]Topic, error) {
	var member bool
	if err := r.pool.QueryRow(ctx,
		`select exists(select 1 from notebook_members where notebook_id = $1 and user_id = $2)`,
		notebookID, userID).Scan(&member); err != nil {
		return nil, apperr.Internal(err)
	}
	if !member {
		return nil, apperr.ErrNotFound
	}
	rows, err := r.pool.Query(ctx,
		`select `+topicCols+` from notebook_topics where notebook_id = $1 order by position, created_at`, notebookID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Topic](rows)
}

// Create/Update/Delete are owner-only: the row is written only if the user is the
// notebook's owner, otherwise nothing happens and it returns NotFound.
func (r *Repository) Create(ctx context.Context, userID, notebookID uuid.UUID, req CreateTopicRequest) (*Topic, error) {
	rows, err := r.pool.Query(ctx,
		`insert into notebook_topics (notebook_id, name, position)
		 select $1, $2, $3
		 where exists(select 1 from notebook_members m
		              where m.notebook_id = $1 and m.user_id = $4 and m.role = '`+roleOwner+`')
		 returning `+topicCols,
		notebookID, req.Name, req.Position, userID)
	if err != nil {
		return nil, err // unique_violation is mapped in the service
	}
	return dbx.One[Topic](rows)
}

func (r *Repository) Update(ctx context.Context, userID, topicID uuid.UUID, req UpdateTopicRequest) (*Topic, error) {
	rows, err := r.pool.Query(ctx,
		`update notebook_topics t set
			name     = coalesce($3, t.name),
			position = coalesce($4, t.position)
		 where t.id = $1
		   and exists(select 1 from notebook_members m
		              where m.notebook_id = t.notebook_id and m.user_id = $2 and m.role = '`+roleOwner+`')
		 returning `+topicCols,
		topicID, userID, req.Name, req.Position)
	if err != nil {
		return nil, err // unique_violation is mapped in the service
	}
	return dbx.One[Topic](rows)
}

func (r *Repository) Delete(ctx context.Context, userID, topicID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`delete from notebook_topics t
		 where t.id = $1
		   and exists(select 1 from notebook_members m
		              where m.notebook_id = t.notebook_id and m.user_id = $2 and m.role = '`+roleOwner+`')`,
		topicID, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}
