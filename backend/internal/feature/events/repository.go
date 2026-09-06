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

const eventCols = `id, user_id, zone_id, material_id, title, kind, starts_at, ends_at, created_at`

// visible is the WHERE fragment (reused across List/Get) that lets a user see an
// event if they own it or it's shared with a zone they belong to. $1 is the user.
const visible = `(e.user_id = $1 or (e.zone_id is not null and exists(
	select 1 from study_zone_members m where m.zone_id = e.zone_id and m.user_id = $1)))`

// List returns the events visible to the user, optionally bounded by [from, to)
// on starts_at and filtered to a single zone. nil pointers mean "no filter".
func (r *Repository) List(ctx context.Context, userID uuid.UUID, from, to *time.Time, zoneID *uuid.UUID) ([]Event, error) {
	rows, err := r.pool.Query(ctx,
		`select `+eventCols+` from events e
		 where `+visible+`
		   and ($2::timestamptz is null or e.starts_at >= $2)
		   and ($3::timestamptz is null or e.starts_at <  $3)
		   and ($4::uuid is null or e.zone_id = $4)
		 order by e.starts_at`,
		userID, from, to, zoneID)
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
// user: a zone_id they're a member of and a material_id they own. If either check
// fails nothing is inserted and it returns NotFound — this both prevents linking
// other people's rows and turns a would-be foreign-key 500 into a clean 404.
func (r *Repository) Create(ctx context.Context, userID uuid.UUID, req CreateEventRequest) (*Event, error) {
	rows, err := r.pool.Query(ctx,
		`insert into events (user_id, zone_id, material_id, title, kind, starts_at, ends_at)
		 select $1, $2, $3, $4, $5, $6, $7
		 where ($2::uuid is null
		     or exists(select 1 from study_zone_members m where m.zone_id = $2 and m.user_id = $1))
		   and ($3::uuid is null
		     or exists(select 1 from materials mt where mt.id = $3 and mt.user_id = $1))
		 returning `+eventCols,
		userID, req.ZoneID, req.MaterialID, req.Title, req.Kind, req.StartsAt, req.EndsAt)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Event](rows)
}

// Update and Delete are restricted to the creator: a zone member who merely sees
// a shared event cannot edit or remove it.
func (r *Repository) Update(ctx context.Context, userID, id uuid.UUID, req UpdateEventRequest) (*Event, error) {
	rows, err := r.pool.Query(ctx,
		`update events set
			title     = coalesce($3, title),
			kind      = coalesce($4, kind),
			starts_at = coalesce($5, starts_at),
			ends_at   = coalesce($6, ends_at)
		 where id = $1 and user_id = $2
		 returning `+eventCols,
		id, userID, req.Title, req.Kind, req.StartsAt, req.EndsAt)
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
