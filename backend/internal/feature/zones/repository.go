package zones

import (
	"context"
	"errors"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbx"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

// 404 with a custom message so we don't reveal whether the uuid exists.
var errInvalidCode = apperr.NotFound("Código de salón inválido")

// Go connects with service_role (bypassing RLS), so EVERY query filters by the
// user in the WHERE clause. That is the contract that upholds security here. In
// v2 ownership is a row in study_zone_members with role='owner', not a column on
// study_zones, so access/owner checks join that table.
const zoneCols = `id, name, subject, is_collaborative, join_code, created_at`

func (r *Repository) accessible(ctx context.Context, userID, zoneID uuid.UUID) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx,
		`select exists(select 1 from study_zone_members where zone_id = $1 and user_id = $2)`,
		zoneID, userID).Scan(&ok)
	if err != nil {
		return false, apperr.Internal(err)
	}
	return ok, nil
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID) ([]Zone, error) {
	rows, err := r.pool.Query(ctx,
		`select `+zoneCols+` from study_zones z
		 where exists(select 1 from study_zone_members m where m.zone_id = z.id and m.user_id = $1)
		 order by z.created_at desc`, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Zone](rows)
}

// Create inserts the zone and, in the same transaction, the creator as its owner
// member (v2 has no owner column). Both succeed or neither does.
func (r *Repository) Create(ctx context.Context, userID uuid.UUID, req CreateZoneRequest, joinCode *string) (*Zone, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	rows, err := tx.Query(ctx,
		`insert into study_zones (name, subject, is_collaborative, join_code)
		 values ($1,$2,$3,$4) returning `+zoneCols,
		req.Name, req.Subject, req.IsCollaborative, joinCode)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	zone, err := dbx.One[Zone](rows)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		`insert into study_zone_members (zone_id, user_id, role) values ($1,$2,$3)`,
		zone.ID, userID, roleOwner); err != nil {
		return nil, apperr.Internal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err)
	}
	return zone, nil
}

func (r *Repository) Get(ctx context.Context, userID, zoneID uuid.UUID) (*Zone, error) {
	rows, err := r.pool.Query(ctx,
		`select `+zoneCols+` from study_zones z
		 where z.id = $1
		   and exists(select 1 from study_zone_members m where m.zone_id = z.id and m.user_id = $2)`,
		zoneID, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Zone](rows)
}

func (r *Repository) Update(ctx context.Context, userID, zoneID uuid.UUID, req UpdateZoneRequest) (*Zone, error) {
	rows, err := r.pool.Query(ctx,
		`update study_zones set
			name    = coalesce($3, name),
			subject = coalesce($4, subject)
		 where id = $1
		   and exists(select 1 from study_zone_members m
		              where m.zone_id = $1 and m.user_id = $2 and m.role = '`+roleOwner+`')
		 returning `+zoneCols,
		zoneID, userID, req.Name, req.Subject)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Zone](rows)
}

func (r *Repository) Delete(ctx context.Context, userID, zoneID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`delete from study_zones where id = $1
		 and exists(select 1 from study_zone_members m
		            where m.zone_id = $1 and m.user_id = $2 and m.role = '`+roleOwner+`')`,
		zoneID, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// JoinByCode is idempotent: an existing member doesn't fail. It replicates in Go
// what the SQL function join_study_zone does for direct mobile access (that one
// depends on auth.uid(), which is null under service_role).
func (r *Repository) JoinByCode(ctx context.Context, userID uuid.UUID, code string) (*Zone, error) {
	rows, err := r.pool.Query(ctx, `select `+zoneCols+` from study_zones where join_code = upper($1) and is_collaborative`, code)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	zone, err := dbx.One[Zone](rows)
	if errors.Is(err, apperr.ErrNotFound) {
		return nil, errInvalidCode
	}
	if err != nil {
		return nil, err
	}
	if _, err := r.pool.Exec(ctx,
		`insert into study_zone_members (zone_id, user_id, role) values ($1,$2,$3) on conflict do nothing`,
		zone.ID, userID, roleMember); err != nil {
		return nil, apperr.Internal(err)
	}
	return zone, nil
}

func (r *Repository) Leave(ctx context.Context, userID, zoneID uuid.UUID) error {
	if _, err := r.pool.Exec(ctx,
		`delete from study_zone_members where zone_id = $1 and user_id = $2`, zoneID, userID); err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (r *Repository) Members(ctx context.Context, userID, zoneID uuid.UUID) ([]Member, error) {
	ok, err := r.accessible(ctx, userID, zoneID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.ErrNotFound
	}
	rows, err := r.pool.Query(ctx,
		`select m.user_id, pr.display_name, m.role, m.joined_at
		 from study_zone_members m
		 left join profiles pr on pr.id = m.user_id
		 where m.zone_id = $1 order by m.joined_at`, zoneID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Member](rows)
}

const objCols = `o.id, o.zone_id, o.title, o.description, o.position, o.created_at`

func (r *Repository) ListObjectives(ctx context.Context, userID, zoneID uuid.UUID) ([]Objective, error) {
	ok, err := r.accessible(ctx, userID, zoneID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.ErrNotFound
	}
	rows, err := r.pool.Query(ctx,
		`select `+objCols+`, coalesce(p.progress_pct, 0) as progress_pct
		 from study_zone_objectives o
		 left join objective_progress p on p.objective_id = o.id and p.user_id = $2
		 where o.zone_id = $1
		 order by o.position, o.created_at`, zoneID, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Objective](rows)
}

func (r *Repository) CreateObjective(ctx context.Context, userID, zoneID uuid.UUID, req CreateObjectiveRequest) (*Objective, error) {
	rows, err := r.pool.Query(ctx,
		`insert into study_zone_objectives (zone_id, title, description, position)
		 select $1, $2, $3, $4
		 where exists(select 1 from study_zone_members m
		              where m.zone_id = $1 and m.user_id = $5 and m.role = '`+roleOwner+`')
		 returning id, zone_id, title, description, position, created_at, 0 as progress_pct`,
		zoneID, req.Title, req.Description, req.Position, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Objective](rows)
}

func (r *Repository) UpdateObjective(ctx context.Context, userID, objID uuid.UUID, req UpdateObjectiveRequest) (*Objective, error) {
	rows, err := r.pool.Query(ctx,
		`update study_zone_objectives o set
			title       = coalesce($3, o.title),
			description = coalesce($4, o.description),
			position    = coalesce($5, o.position)
		 where o.id = $1
		   and exists(select 1 from study_zone_members m
		              where m.zone_id = o.zone_id and m.user_id = $2 and m.role = '`+roleOwner+`')
		 returning o.id, o.zone_id, o.title, o.description, o.position, o.created_at, 0 as progress_pct`,
		objID, userID, req.Title, req.Description, req.Position)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Objective](rows)
}

func (r *Repository) DeleteObjective(ctx context.Context, userID, objID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`delete from study_zone_objectives o
		 where o.id = $1
		   and exists(select 1 from study_zone_members m
		              where m.zone_id = o.zone_id and m.user_id = $2 and m.role = '`+roleOwner+`')`,
		objID, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// SetProgress upserts progress only if the user belongs to the objective's zone;
// otherwise nothing is inserted and it returns NotFound.
func (r *Repository) SetProgress(ctx context.Context, userID, objID uuid.UUID, pct int) (*Progress, error) {
	rows, err := r.pool.Query(ctx,
		`insert into objective_progress (objective_id, user_id, progress_pct)
		 select $1, $2, $3
		 where exists(
			select 1 from study_zone_objectives o
			join study_zone_members m on m.zone_id = o.zone_id
			where o.id = $1 and m.user_id = $2)
		 on conflict (objective_id, user_id) do update
			set progress_pct = excluded.progress_pct, updated_at = now()
		 returning objective_id, user_id, progress_pct, updated_at`,
		objID, userID, pct)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Progress](rows)
}
