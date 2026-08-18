// Package attachments registers files that the mobile client uploads straight to
// Supabase Storage (via a signed URL) and triggers their text extraction.
package attachments

import (
	"strings"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

const maxUploadBytes = 25 << 20 // 25 MB

// allowedMIME is the set of file types the study assistant can ingest. Editing
// this list is the only place the allowlist lives.
//
// ponytail: the declared size/mime are advisory — a signed URL can't stop the
// client from PUTting a larger or different file. The hard cap is the Supabase
// bucket policy (file_size_limit + allowed_mime_types); see docs/architecture.md.
// This edge check just rejects obviously-wrong input early with a clean 400.
var allowedMIME = map[string]bool{
	"application/pdf": true,
	"image/png":       true,
	"image/jpeg":      true,
	"image/webp":      true,
	"text/plain":      true,
	"text/markdown":   true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document":   true, // .docx
	"application/vnd.openxmlformats-officedocument.presentationml.presentation": true, // .pptx
}

func validMIME(m string) bool { return allowedMIME[strings.ToLower(strings.TrimSpace(m))] }

// Text-extraction outcomes (processing_status enum in the DB).
const (
	statusReady  = "ready"
	statusFailed = "failed"
)

type Attachment struct {
	ID               uuid.UUID  `db:"id" json:"id"`
	ConversationID   *uuid.UUID `db:"conversation_id" json:"conversation_id"`
	UserID           uuid.UUID  `db:"user_id" json:"user_id"`
	StoragePath      string     `db:"storage_path" json:"storage_path"`
	FileName         string     `db:"file_name" json:"file_name"`
	MimeType         *string    `db:"mime_type" json:"mime_type"`
	SizeBytes        *int64     `db:"size_bytes" json:"size_bytes"`
	ExtractedText    *string    `db:"extracted_text" json:"extracted_text"`
	ProcessingStatus string     `db:"processing_status" json:"processing_status"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
}

// UploadURLRequest requests a signed URL. Size and name are validated BEFORE signing.
type UploadURLRequest struct {
	FileName  string `json:"file_name"`
	MimeType  string `json:"mime_type"`
	SizeBytes int64  `json:"size_bytes"`
}

func (r UploadURLRequest) Validate() error {
	v := apperr.NewValidation()
	if strings.TrimSpace(r.FileName) == "" {
		v.Add("file_name", "requerido")
	}
	if r.SizeBytes <= 0 {
		v.Add("size_bytes", "requerido")
	} else if r.SizeBytes > maxUploadBytes {
		v.Add("size_bytes", "máximo 25 MB")
	}
	if !validMIME(r.MimeType) {
		v.Add("mime_type", "tipo de archivo no soportado")
	}
	return v.Err()
}

// RegisterRequest registers the file already uploaded to Storage.
type RegisterRequest struct {
	ConversationID *uuid.UUID `json:"conversation_id"`
	StoragePath    string     `json:"storage_path"`
	FileName       string     `json:"file_name"`
	MimeType       *string    `json:"mime_type"`
	SizeBytes      *int64     `json:"size_bytes"`
}

func (r RegisterRequest) Validate() error {
	v := apperr.NewValidation()
	if strings.TrimSpace(r.StoragePath) == "" {
		v.Add("storage_path", "requerido")
	}
	if strings.TrimSpace(r.FileName) == "" {
		v.Add("file_name", "requerido")
	}
	if r.MimeType != nil && !validMIME(*r.MimeType) {
		v.Add("mime_type", "tipo de archivo no soportado")
	}
	if r.SizeBytes != nil && *r.SizeBytes > maxUploadBytes {
		v.Add("size_bytes", "máximo 25 MB")
	}
	return v.Err()
}
