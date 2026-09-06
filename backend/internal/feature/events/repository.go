package events

import (
	"context"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbx"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const eventCols = `id, user_id, notebook_id, material_id, subject_id, title, description, kind, starts_at, ends_at, created_at`

// visible is the WHERE fragment (reused across List/Get) that lets a user see an
// event if they own it or it's shared with a notebook they belong to. $1 is the user.
const visible = `(e.user_id = $1 or (e.notebook_id is not null and exists(
	select 1 from notebook_members m where m.notebook_id = e.notebook_id and m.user_id = $1)))`

// List returns the events visible to the user, optionally bounded by [from, to)
// on starts_at and filtered to a single notebook. nil pointers mean "no filter".
func (r *Repository) List(ctx context.Context, userID uuid.UUID, from, to *time.Time, notebookID *uuid.UUID) ([]Event, error) {
	rows, err := r.pool.Query(ctx,
		`select `+eventCols+` from events e
		 where `+visible+`
		   and ($2::timestamptz is null or e.starts_at >= $2)
		   and ($3::timestamptz is null or e.starts_at <  $3)
		   and ($4::uuid is null or e.notebook_id = $4)
		 order by e.starts_at`,
		userID, from, to, notebookID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Event](rows)
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*Event, error) {
	rows, err := r.pool.Query(ctx,
		`select `+eventCols+` from events e where e.id = $2 and `+visible, userID, id)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Event](rows)
}

// Create inserts the event, but only if its optional references belong to the
// user: a notebook_id they're a member of and a material_id they own. If either check
// fails nothing is inserted and it returns NotFound — this both prevents linking
// other people's rows and turns a would-be foreign-key 500 into a clean 404.
func (r *Repository) Create(ctx context.Context, userID uuid.UUID, req CreateEventRequest) (*Event, error) {
	rows, err := r.pool.Query(ctx,
		`insert into events (user_id, notebook_id, material_id, subject_id, title, description, kind, starts_at, ends_at)
		 select $1, $2, $3, $4, $5, $6, $7, $8, $9
		 where ($2::uuid is null
		     or exists(select 1 from notebook_members m where m.notebook_id = $2 and m.user_id = $1))
		   and ($3::uuid is null
		     or exists(select 1 from materials mt where mt.id = $3 and mt.user_id = $1))
		   and ($4::smallint is null
		     or exists(select 1 from subjects s where s.id = $4 and (s.created_by is null or s.created_by = $1)))
		 returning `+eventCols,
		userID, req.NotebookID, req.MaterialID, req.SubjectID, req.Title, req.Description, req.Kind, req.StartsAt, req.EndsAt)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Event](rows)
}

// Update and Delete are restricted to the creator: a notebook member who merely sees
// a shared event cannot edit or remove it.
func (r *Repository) Update(ctx context.Context, userID, id uuid.UUID, req UpdateEventRequest) (*Event, error) {
	rows, err := r.pool.Query(ctx,
		`update events set
			title       = coalesce($3, title),
			description = coalesce($4, description),
			subject_id  = coalesce($5, subject_id),
			kind        = coalesce($6, kind),
			starts_at   = coalesce($7, starts_at),
			ends_at     = coalesce($8, ends_at)
		 where id = $1 and user_id = $2
		   and ($5::smallint is null
		     or exists(select 1 from subjects s where s.id = $5 and (s.created_by is null or s.created_by = $2)))
		 returning `+eventCols,
		id, userID, req.Title, req.Description, req.SubjectID, req.Kind, req.StartsAt, req.EndsAt)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Event](rows)
}

func (r *Repository) Delete(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `delete from events where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}
