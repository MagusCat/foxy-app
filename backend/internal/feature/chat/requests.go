package chat

import (
	"strings"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

type CreateConversationRequest struct {
	NotebookID *uuid.UUID `json:"notebook_id"`
	SubjectID  *int16     `json:"subject_id"`
	Kind       string     `json:"kind"`
	Title      *string    `json:"title"`
}

func (r CreateConversationRequest) Validate() error {
	v := apperr.NewValidation()
	if r.Kind != "" && !convKinds[r.Kind] {
		v.Add("kind", "debe ser ai o group")
	}
	if r.Title != nil && len(*r.Title) > 200 {
		v.Add("title", "máximo 200 caracteres")
	}
	return v.Err()
}

type SendMessageRequest struct {
	Content string  `json:"content"`
	Mode    *string `json:"mode"`
}

func (r SendMessageRequest) Validate() error {
	v := apperr.NewValidation()
	if c := strings.TrimSpace(r.Content); c == "" {
		v.Add("content", "requerido")
	} else if len(c) > 8000 {
		v.Add("content", "máximo 8000 caracteres")
	}
	if r.Mode != nil && !msgModes[*r.Mode] {
		v.Add("mode", "debe ser respuesta, pasos o quiz")
	}
	return v.Err()
}

type SetSavedRequest struct {
	Saved bool `json:"saved"`
}

func (r SetSavedRequest) Validate() error { return nil }
