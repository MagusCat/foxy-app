package profile

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

const profileCols = `id, display_name, system_role, user_kind, profession_id, current_streak,
	longest_streak, last_active_date, academic_level, study_time_avg_min,
	main_goal, custom_instructions, created_at`

func (r *Repository) Get(ctx context.Context, id uuid.UUID) (*Profile, error) {
	rows, err := r.pool.Query(ctx, `select `+profileCols+` from profiles where id = $1`, id)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Profile](rows)
}

// Update applies only the present fields: COALESCE keeps the previous value when
// the argument arrives NULL. system_role isn't here: the user cannot touch it.
func (r *Repository) Update(ctx context.Context, id uuid.UUID, req UpdateProfileRequest) (*Profile, error) {
	rows, err := r.pool.Query(ctx,
		`update profiles set
			display_name        = coalesce($2, display_name),
			user_kind           = coalesce($3::user_kind, user_kind),
			profession_id       = coalesce($4, profession_id),
			academic_level      = coalesce($5::academic_level, academic_level),
			study_time_avg_min  = coalesce($6, study_time_avg_min),
			main_goal           = coalesce($7, main_goal),
			custom_instructions = coalesce($8, custom_instructions)
		 where id = $1
		 returning `+profileCols,
		id, req.DisplayName, req.UserKind, req.ProfessionID, req.AcademicLevel,
		req.StudyTimeAvgMin, req.MainGoal, req.CustomInstructions)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Profile](rows)
}

// TouchStreak advances the streak once per day; the WHERE makes it idempotent.
func (r *Repository) TouchStreak(ctx context.Context, id uuid.UUID) error {
	_, err := r.pool.Exec(ctx,
		`update profiles set
			current_streak = case when last_active_date = current_date - 1 then current_streak + 1 else 1 end,
			longest_streak = greatest(longest_streak,
				case when last_active_date = current_date - 1 then current_streak + 1 else 1 end),
			last_active_date = current_date
		 where id = $1 and (last_active_date is null or last_active_date < current_date)`, id)
	return err
}

func (r *Repository) ListProfessions(ctx context.Context) ([]Profession, error) {
	rows, err := r.pool.Query(ctx, `select id, slug, name from professions order by name`)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Profession](rows)
}

// UpsertProfession inserts the profession or returns the existing one with that slug.
func (r *Repository) UpsertProfession(ctx context.Context, slug, name string) (*Profession, error) {
	rows, err := r.pool.Query(ctx,
		`insert into professions (slug, name) values ($1, $2)
		 on conflict (slug) do update set slug = excluded.slug
		 returning id, slug, name`, slug, name)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Profession](rows)
}
