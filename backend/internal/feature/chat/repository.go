package chat

import (
	"context"

	"github.com/foxy-app/backend/internal/platform/aiclient"
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

const convCols = `id, user_id, notebook_id, subject_id, kind, title, created_at, updated_at`
const msgCols = `id, conversation_id, sender_id, role, content, saved, mode, created_at`

func (r *Repository) ListConversations(ctx context.Context, userID uuid.UUID, notebookID *uuid.UUID, subjectID *int16, c *page.Cursor, limit int) ([]Conversation, string, error) {
	ct, cid := c.Args()
	rows, err := r.pool.Query(ctx,
		`select `+convCols+` from conversations
		 where user_id = $1
		   and ($2::uuid is null or notebook_id = $2)
		   and ($3::smallint is null or subject_id = $3)
		   and ($4::timestamptz is null or (updated_at, id) < ($4, $5))
		 order by updated_at desc, id desc
		 limit $6`,
		userID, notebookID, subjectID, ct, cid, limit+1)
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

// CreateConversation only accepts a notebook the user belongs to and a subject
// they may reference. The checks ride in the INSERT so there is no gap between
// asking and writing. No membership means no row and a clean 404 instead of a
// conversation living inside somebody else's notebook.
func (r *Repository) CreateConversation(ctx context.Context, userID uuid.UUID, req CreateConversationRequest) (*Conversation, error) {
	rows, err := r.pool.Query(ctx,
		`insert into conversations (user_id, notebook_id, subject_id, kind, title)
		 select $1, $2, $3, $4, $5
		 where ($2::uuid is null
		        or exists(select 1 from notebook_members m where m.notebook_id = $2 and m.user_id = $1))
		   and ($3::smallint is null
		        or exists(select 1 from subjects s where s.id = $3 and (s.created_by is null or s.created_by = $1)))
		 returning `+convCols,
		userID, req.NotebookID, req.SubjectID, req.Kind, req.Title)
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

// InsertUserMessage records the human turn. sender_id is the authenticated user,
// never a request field, and mode is only meaningful on this path.
func (r *Repository) InsertUserMessage(ctx context.Context, convID, senderID uuid.UUID, content string, mode *string) (*Message, error) {
	rows, err := r.pool.Query(ctx,
		`insert into messages (conversation_id, sender_id, role, content, mode)
		 values ($1,$2,$3,$4,$5) returning `+msgCols,
		convID, senderID, roleUser, content, mode)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Message](rows)
}

// InsertAssistantMessage records the AI turn: sender_id stays NULL.
func (r *Repository) InsertAssistantMessage(ctx context.Context, convID uuid.UUID, content string) (*Message, error) {
	rows, err := r.pool.Query(ctx,
		`insert into messages (conversation_id, role, content)
		 values ($1,$2,$3) returning `+msgCols,
		convID, roleAssistant, content)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Message](rows)
}

// SetSaved toggles the bookmark. The membership check rides in the WHERE via the
// owning conversation, so a foreign message is NotFound, not touched.
func (r *Repository) SetSaved(ctx context.Context, userID, msgID uuid.UUID, saved bool) (*Message, error) {
	rows, err := r.pool.Query(ctx,
		`update messages m set saved = $3
		 where m.id = $1
		   and exists(select 1 from conversations c where c.id = m.conversation_id and c.user_id = $2)
		 returning `+msgCols,
		msgID, userID, saved)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Message](rows)
}

// ListSaved returns the user's bookmarked messages across every conversation,
// newest first. Keyset over (created_at, id) on the idx_messages_saved index.
func (r *Repository) ListSaved(ctx context.Context, userID uuid.UUID, c *page.Cursor, limit int) ([]Message, string, error) {
	ct, cid := c.Args()
	rows, err := r.pool.Query(ctx,
		`select `+msgCols+` from messages
		 where sender_id = $1 and saved
		   and ($2::timestamptz is null or (created_at, id) < ($2, $3))
		 order by created_at desc, id desc
		 limit $4`,
		userID, ct, cid, limit+1)
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

// GatherContext collects the profile material that shapes the prompt. It touches
// other domains' tables (profiles, notebook_objectives) on purpose: it's
// read-only assembly of the context, not those domains' logic.
//
// It fills the wire type directly: this data has no other use in the backend, and
// a local copy of it would be one more thing to keep in sync with the ai-service.
func (r *Repository) GatherContext(ctx context.Context, userID uuid.UUID, notebookID *uuid.UUID) (*aiclient.ChatContext, error) {
	pc := &aiclient.ChatContext{}

	err := r.pool.QueryRow(ctx,
		`select user_kind, academic_level, main_goal, custom_instructions
		 from profiles where id = $1`, userID).
		Scan(&pc.UserKind, &pc.AcademicLevel, &pc.MainGoal, &pc.CustomInstructions)
	if err != nil {
		return nil, apperr.Internal(err)
	}

	if notebookID != nil {
		rows, err := r.pool.Query(ctx,
			`select title from notebook_objectives where notebook_id = $1 order by position`, *notebookID)
		if err != nil {
			return nil, apperr.Internal(err)
		}
		pc.Objectives, err = pgx.CollectRows(rows, pgx.RowTo[string])
		if err != nil {
			return nil, apperr.Internal(err)
		}
	}

	return pc, nil
}

func (r *Repository) TouchConversation(ctx context.Context, convID uuid.UUID) error {
	if _, err := r.pool.Exec(ctx, `update conversations set updated_at = now() where id = $1`, convID); err != nil {
		return apperr.Internal(err)
	}
	return nil
}
