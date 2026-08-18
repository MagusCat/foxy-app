package chat

import (
	"context"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbx"
	"github.com/foxy-app/backend/internal/platform/page"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const convCols = `id, user_id, zone_id, title, created_at, updated_at`
const msgCols = `id, conversation_id, role, content, created_at`

func (r *Repository) ListConversations(ctx context.Context, userID uuid.UUID, zoneID *uuid.UUID, c *page.Cursor, limit int) ([]Conversation, string, error) {
	ct, cid := c.Args()
	rows, err := r.pool.Query(ctx,
		`select `+convCols+` from conversations
		 where user_id = $1
		   and ($2::uuid is null or zone_id = $2)
		   and ($3::timestamptz is null or (updated_at, id) < ($3, $4))
		 order by updated_at desc, id desc
		 limit $5`,
		userID, zoneID, ct, cid, limit+1)
	if err != nil {
		return nil, "", apperr.Internal(err)
	}
	list, err := dbx.Many[Conversation](rows)
	if err != nil {
		return nil, "", err
	}
	items, next := page.Slice(list, limit, func(c Conversation) string {
		return page.Encode(c.UpdatedAt, c.ID)
	})
	return items, next, nil
}

func (r *Repository) CreateConversation(ctx context.Context, userID uuid.UUID, zoneID *uuid.UUID, title *string) (*Conversation, error) {
	rows, err := r.pool.Query(ctx,
		`insert into conversations (user_id, zone_id, title) values ($1,$2,$3) returning `+convCols,
		userID, zoneID, title)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Conversation](rows)
}

func (r *Repository) GetConversation(ctx context.Context, userID, id uuid.UUID) (*Conversation, error) {
	rows, err := r.pool.Query(ctx, `select `+convCols+` from conversations where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Conversation](rows)
}

func (r *Repository) DeleteConversation(ctx context.Context, userID, id uuid.UUID) error {
	tag, err := r.pool.Exec(ctx, `delete from conversations where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return apperr.Internal(err)
	}
	if tag.RowsAffected() == 0 {
		return apperr.ErrNotFound
	}
	return nil
}

// ListMessages assumes the conversation was already verified as the user's.
func (r *Repository) ListMessages(ctx context.Context, convID uuid.UUID, c *page.Cursor, limit int) ([]Message, string, error) {
	ct, cid := c.Args()
	rows, err := r.pool.Query(ctx,
		`select `+msgCols+` from messages
		 where conversation_id = $1
		   and ($2::timestamptz is null or (created_at, id) < ($2, $3))
		 order by created_at desc, id desc
		 limit $4`,
		convID, ct, cid, limit+1)
	if err != nil {
		return nil, "", apperr.Internal(err)
	}
	list, err := dbx.Many[Message](rows)
	if err != nil {
		return nil, "", err
	}
	items, next := page.Slice(list, limit, func(m Message) string {
		return page.Encode(m.CreatedAt, m.ID)
	})
	return items, next, nil
}

// RecentMessages returns the last n messages in ascending order, to build the
// context sent to the ai-service.
func (r *Repository) RecentMessages(ctx context.Context, convID uuid.UUID, n int) ([]Message, error) {
	rows, err := r.pool.Query(ctx,
		`select * from (
			select `+msgCols+` from messages where conversation_id = $1
			order by created_at desc, id desc limit $2
		 ) t order by created_at asc, id asc`,
		convID, n)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.Many[Message](rows)
}

func (r *Repository) InsertMessage(ctx context.Context, convID uuid.UUID, role, content string) (*Message, error) {
	rows, err := r.pool.Query(ctx,
		`insert into messages (conversation_id, role, content)
		 values ($1,$2,$3) returning `+msgCols,
		convID, role, content)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Message](rows)
}

// GatherContext collects the material that shapes the prompt. It touches other
// domains' tables (profiles, study_zone_objectives, attachments) on purpose: it's
// read-only assembly of the context, not those domains' logic.
func (r *Repository) GatherContext(ctx context.Context, userID uuid.UUID, zoneID *uuid.UUID, convID uuid.UUID) (*PromptContext, error) {
	pc := &PromptContext{}

	err := r.pool.QueryRow(ctx,
		`select user_kind, academic_level, main_goal, study_time_avg_min, custom_instructions
		 from profiles where id = $1`, userID).
		Scan(&pc.UserKind, &pc.AcademicLevel, &pc.MainGoal, &pc.StudyTimeAvgMin, &pc.CustomInstructions)
	if err != nil {
		return nil, apperr.Internal(err)
	}

	if zoneID != nil {
		rows, err := r.pool.Query(ctx,
			`select title from study_zone_objectives where zone_id = $1 order by position`, *zoneID)
		if err != nil {
			return nil, apperr.Internal(err)
		}
		pc.Objectives, err = pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			return nil, apperr.Internal(err)
		}
	}

	rows, err := r.pool.Query(ctx,
		`select extracted_text from attachments
		 where conversation_id = $1 and extracted_text is not null and extracted_text <> ''
		 order by created_at desc limit 5`, convID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	pc.Documents, err = pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return pc, nil
}

func (r *Repository) TouchConversation(ctx context.Context, convID uuid.UUID) error {
	if _, err := r.pool.Exec(ctx, `update conversations set updated_at = now() where id = $1`, convID); err != nil {
		return apperr.Internal(err)
	}
	return nil
}
