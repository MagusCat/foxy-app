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

const topicCols = `id, zone_id, name, position, created_at`

// List returns the zone's topics, but only if the user belongs to the zone;
// otherwise NotFound (don't reveal a zone they can't see).
func (r *Repository) List(ctx context.Context, userID, zoneID uuid.UUID) ([]Topic, error) {
	var member bool
	if err := r.pool.QueryRow(ctx,
		`select exists(select 1 from study_zone_members where zone_id = $1 and user_id = $2)`,
		zoneID, userID).Scan(&member); err != nil {
		return nil, apperr.Internal(err)
	}
	if !member {
		return nil, apperr.ErrNotFound
	}
	rows, err := r.pool.Query(ctx,
		`select `+topicCols+` from study_zone_topics where zone_id = $1 order by position, created_at`, zoneID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Topic](rows)
}

// Create/Update/Delete are owner-only: the row is written only if the user is the
// zone's owner, otherwise nothing happens and it returns NotFound.
func (r *Repository) Create(ctx context.Context, userID, zoneID uuid.UUID, req CreateTopicRequest) (*Topic, error) {
	rows, err := r.pool.Query(ctx,
		`insert into study_zone_topics (zone_id, name, position)
		 select $1, $2, $3
		 where exists(select 1 from study_zone_members m
		              where m.zone_id = $1 and m.user_id = $4 and m.role = '`+roleOwner+`')
		 returning `+topicCols,
		zoneID, req.Name, req.Position, userID)
	if err != nil {
		return nil, err // unique_violation is mapped in the service
	}
	return dbx.One[Topic](rows)
}

func (r *Repository) Update(ctx context.Context, userID, topicID uuid.UUID, req UpdateTopicRequest) (*Topic, error) {
	rows, err := r.pool.Query(ctx,
		`update study_zone_topics t set
			name     = coalesce($3, t.name),
			position = coalesce($4, t.position)
		 where t.id = $1
		   and exists(select 1 from study_zone_members m
		              where m.zone_id = t.zone_id and m.user_id = $2 and m.role = '`+roleOwner+`')
		 returning `+topicCols,
		topicID, userID, req.Name, req.Position)
	if err != nil {
		return nil, err // unique_violation is mapped in the service
	}
	return dbx.One[Topic](rows)
}

func (r *Repository) Delete(ctx context.Context, userID, topicID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`delete from study_zone_topics t
		 where t.id = $1
		   and exists(select 1 from study_zone_members m
		              where m.zone_id = t.zone_id and m.user_id = $2 and m.role = '`+roleOwner+`')`,
		topicID, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}
