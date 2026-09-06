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

const profileCols = `id, display_name, avatar_url, system_role, user_kind, profession_id,
	academic_level, main_goal, custom_instructions, current_streak, longest_streak,
	last_active_date, streak_freezes, streak_frozen_days, preferences, created_at`

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
			avatar_url          = coalesce($3, avatar_url),
			user_kind           = coalesce($4::user_kind, user_kind),
			profession_id       = coalesce($5, profession_id),
			academic_level      = coalesce($6, academic_level),
			main_goal           = coalesce($7, main_goal),
			custom_instructions = coalesce($8, custom_instructions),
			preferences         = coalesce($9::jsonb, preferences)
		 where id = $1
		 returning `+profileCols,
		id, req.DisplayName, req.AvatarURL, req.UserKind, req.ProfessionID,
		req.AcademicLevel, req.MainGoal, req.CustomInstructions, req.Preferences)
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

// ListSubjects returns the global catalog plus the caller's own subjects; the
// predicate keeps another user's private subject names from leaking.
func (r *Repository) ListSubjects(ctx context.Context, userID uuid.UUID) ([]Subject, error) {
	rows, err := r.pool.Query(ctx,
		`select id, slug, name from subjects where created_by is null or created_by = $1 order by name`, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Subject](rows)
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
