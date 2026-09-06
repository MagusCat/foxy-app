package attachments

import (
	"context"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbx"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	pool *pgxpool.Pool
}

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

const attachmentCols = `id, conversation_id, user_id, storage_path, file_name,
	mime_type, size_bytes, extracted_text, processing_status, created_at`

func (r *Repository) Insert(ctx context.Context, userID uuid.UUID, req RegisterRequest) (*Attachment, error) {
	rows, err := r.pool.Query(ctx,
		`insert into attachments (conversation_id, user_id, storage_path, file_name, mime_type, size_bytes)
		 values ($1,$2,$3,$4,$5,$6) returning `+attachmentCols,
		req.ConversationID, userID, req.StoragePath, req.FileName, req.MimeType, req.SizeBytes)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Attachment](rows)
}

func (r *Repository) Get(ctx context.Context, userID, id uuid.UUID) (*Attachment, error) {
	rows, err := r.pool.Query(ctx, `select `+attachmentCols+` from attachments where id = $1 and user_id = $2`, id, userID)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return dbx.One[Attachment](rows)
}

// visibleLimit bounds how many attachments the AI search can span.
const visibleLimit = 50

// VisibleIDs returns the attachments whose text the AI may search for this user:
// the ones in this conversation plus the ones in this notebook. Authorization
// lives here and only here; the ai-service searches inside the ids it is given
// and decides nothing.
func (r *Repository) VisibleIDs(ctx context.Context, userID uuid.UUID, notebookID, convID *uuid.UUID) ([]uuid.UUID, error) {
	rows, err := r.pool.Query(ctx,
		`select a.id from attachments a
		 left join conversations c on c.id = a.conversation_id
		 where a.user_id = $1
		   and a.processing_status = 'ready'
		   and (($2::uuid is not null and a.conversation_id = $2)
		     or ($3::uuid is not null and c.notebook_id = $3))
		 order by a.created_at desc
		 limit $4`,
		userID, convID, notebookID, visibleLimit)
	if err != nil {
		return nil, apperr.Internal(err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[uuid.UUID])
	if err != nil {
		return nil, apperr.Internal(err)
	}
	return ids, nil
}

func (r *Repository) SetExtracted(ctx context.Context, id uuid.UUID, text, status string) error {
	_, err := r.pool.Exec(ctx,
		`update attachments set extracted_text = $2, processing_status = $3 where id = $1`,
		id, text, status)
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}
