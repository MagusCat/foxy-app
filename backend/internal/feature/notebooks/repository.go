package notebooks

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
var errInvalidCode = apperr.NotFound("Código de cuaderno inválido")

// Go connects with service_role (bypassing RLS), so EVERY query filters by the
// user in the WHERE clause. That is the contract that upholds security here.
// Ownership is a row in notebook_members with role='owner', not a column on
// notebooks, so access/owner checks join that table.
const notebookCols = `id, name, subject_id, is_collaborative, join_code, created_at`

func (r *Repository) accessible(ctx context.Context, userID, notebookID uuid.UUID) (bool, error) {
	var ok bool
	err := r.pool.QueryRow(ctx,
		`select exists(select 1 from notebook_members where notebook_id = $1 and user_id = $2)`,
		notebookID, userID).Scan(&ok)
	if err != nil {
		return false, apperr.Internal(err)
	}
	return ok, nil
}

func (r *Repository) List(ctx context.Context, userID uuid.UUID) ([]Notebook, error) {
	rows, err := r.pool.Query(ctx,
		`select `+notebookCols+` from notebooks z
		 where exists(select 1 from notebook_members m where m.notebook_id = z.id and m.user_id = $1)
		 order by z.created_at desc`, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Notebook](rows)
}

// Create inserts the notebook and, in the same transaction, the creator as its owner
// member (there is no owner column). Both succeed or neither does.
func (r *Repository) Create(ctx context.Context, userID uuid.UUID, req CreateNotebookRequest, joinCode *string) (*Notebook, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed

	rows, err := tx.Query(ctx,
		`insert into notebooks (name, subject_id, is_collaborative, join_code)
		 select $1,$2,$3,$4
		 where $2::smallint is null or exists(select 1 from subjects s
		       where s.id = $2 and (s.created_by is null or s.created_by = $5))
		 returning `+notebookCols,
		req.Name, req.SubjectID, req.IsCollaborative, joinCode, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	notebook, err := dbx.One[Notebook](rows)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx,
		`insert into notebook_members (notebook_id, user_id, role) values ($1,$2,$3)`,
		notebook.ID, userID, roleOwner); err != nil {
		return nil, apperr.Internal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, apperr.Internal(err)
	}
	return notebook, nil
}

func (r *Repository) Get(ctx context.Context, userID, notebookID uuid.UUID) (*Notebook, error) {
	rows, err := r.pool.Query(ctx,
		`select `+notebookCols+` from notebooks z
		 where z.id = $1
		   and exists(select 1 from notebook_members m where m.notebook_id = z.id and m.user_id = $2)`,
		notebookID, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Notebook](rows)
}

func (r *Repository) Update(ctx context.Context, userID, notebookID uuid.UUID, req UpdateNotebookRequest) (*Notebook, error) {
	rows, err := r.pool.Query(ctx,
		`update notebooks set
			name       = coalesce($3, name),
			subject_id = coalesce($4, subject_id)
		 where id = $1
		   and exists(select 1 from notebook_members m
		              where m.notebook_id = $1 and m.user_id = $2 and m.role = '`+roleOwner+`')
		   and ($4::smallint is null or exists(select 1 from subjects s
		        where s.id = $4 and (s.created_by is null or s.created_by = $2)))
		 returning `+notebookCols,
		notebookID, userID, req.Name, req.SubjectID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Notebook](rows)
}

func (r *Repository) Delete(ctx context.Context, userID, notebookID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`delete from notebooks where id = $1
		 and exists(select 1 from notebook_members m
		            where m.notebook_id = $1 and m.user_id = $2 and m.role = '`+roleOwner+`')`,
		notebookID, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// JoinByCode is idempotent: an existing member doesn't fail. It replicates in Go
// what the SQL function join_notebook would do for direct mobile access (that one
// depends on auth.uid(), which is null under service_role).
func (r *Repository) JoinByCode(ctx context.Context, userID uuid.UUID, code string) (*Notebook, error) {
	rows, err := r.pool.Query(ctx, `select `+notebookCols+` from notebooks where join_code = upper($1) and is_collaborative`, code)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	notebook, err := dbx.One[Notebook](rows)
	if errors.Is(err, apperr.ErrNotFound) {
		return nil, errInvalidCode
	}
	if err != nil {
		return nil, err
	}
	if _, err := r.pool.Exec(ctx,
		`insert into notebook_members (notebook_id, user_id, role) values ($1,$2,$3) on conflict do nothing`,
		notebook.ID, userID, roleMember); err != nil {
		return nil, apperr.Internal(err)
	}
	return notebook, nil
}

func (r *Repository) Leave(ctx context.Context, userID, notebookID uuid.UUID) error {
	if _, err := r.pool.Exec(ctx,
		`delete from notebook_members where notebook_id = $1 and user_id = $2`, notebookID, userID); err != nil {
		return apperr.Internal(err)
	}
	return nil
}

func (r *Repository) Members(ctx context.Context, userID, notebookID uuid.UUID) ([]Member, error) {
	ok, err := r.accessible(ctx, userID, notebookID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.ErrNotFound
	}
	rows, err := r.pool.Query(ctx,
		`select m.user_id, pr.display_name, m.role, m.joined_at
		 from notebook_members m
		 left join profiles pr on pr.id = m.user_id
		 where m.notebook_id = $1 order by m.joined_at`, notebookID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Member](rows)
}

const objCols = `o.id, o.notebook_id, o.title, o.description, o.position, o.created_at`

func (r *Repository) ListObjectives(ctx context.Context, userID, notebookID uuid.UUID) ([]Objective, error) {
	ok, err := r.accessible(ctx, userID, notebookID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, apperr.ErrNotFound
	}
	rows, err := r.pool.Query(ctx,
		`select `+objCols+`, coalesce(p.progress_pct, 0) as progress_pct
		 from notebook_objectives o
		 left join objective_progress p on p.objective_id = o.id and p.user_id = $2
		 where o.notebook_id = $1
		 order by o.position, o.created_at`, notebookID, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Objective](rows)
}

func (r *Repository) CreateObjective(ctx context.Context, userID, notebookID uuid.UUID, req CreateObjectiveRequest) (*Objective, error) {
	rows, err := r.pool.Query(ctx,
		`insert into notebook_objectives (notebook_id, title, description, position)
		 select $1, $2, $3, $4
		 where exists(select 1 from notebook_members m
		              where m.notebook_id = $1 and m.user_id = $5 and m.role = '`+roleOwner+`')
		 returning id, notebook_id, title, description, position, created_at, 0 as progress_pct`,
		notebookID, req.Title, req.Description, req.Position, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Objective](rows)
}

func (r *Repository) UpdateObjective(ctx context.Context, userID, objID uuid.UUID, req UpdateObjectiveRequest) (*Objective, error) {
	rows, err := r.pool.Query(ctx,
		`update notebook_objectives o set
			title       = coalesce($3, o.title),
			description = coalesce($4, o.description),
			position    = coalesce($5, o.position)
		 where o.id = $1
		   and exists(select 1 from notebook_members m
		              where m.notebook_id = o.notebook_id and m.user_id = $2 and m.role = '`+roleOwner+`')
		 returning o.id, o.notebook_id, o.title, o.description, o.position, o.created_at, 0 as progress_pct`,
		objID, userID, req.Title, req.Description, req.Position)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Objective](rows)
}

func (r *Repository) DeleteObjective(ctx context.Context, userID, objID uuid.UUID) error {
	tag, err := r.pool.Exec(ctx,
		`delete from notebook_objectives o
		 where o.id = $1
		   and exists(select 1 from notebook_members m
		              where m.notebook_id = o.notebook_id and m.user_id = $2 and m.role = '`+roleOwner+`')`,
		objID, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// SetProgress upserts progress only if the user belongs to the objective's notebook;
// otherwise nothing is inserted and it returns NotFound.
func (r *Repository) SetProgress(ctx context.Context, userID, objID uuid.UUID, pct int) (*Progress, error) {
	rows, err := r.pool.Query(ctx,
		`insert into objective_progress (objective_id, user_id, progress_pct)
		 select $1, $2, $3
		 where exists(
			select 1 from notebook_objectives o
			join notebook_members m on m.notebook_id = o.notebook_id
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
