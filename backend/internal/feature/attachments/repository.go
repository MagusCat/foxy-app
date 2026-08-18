package attachments

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

func (r *Repository) SetExtracted(ctx context.Context, id uuid.UUID, text, status string) error {
	_, err := r.pool.Exec(ctx,
		`update attachments set extracted_text = $2, processing_status = $3 where id = $1`,
		id, text, status)
	if err != nil {
		return apperr.Internal(err)
	}
	return nil
}
