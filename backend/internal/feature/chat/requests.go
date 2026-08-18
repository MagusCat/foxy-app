package chat

import (
	"strings"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

type CreateConversationRequest struct {
	ZoneID *uuid.UUID `json:"zone_id"`
	Title  *string    `json:"title"`
}

func (r CreateConversationRequest) Validate() error {
	v := apperr.NewValidation()
	if r.Title != nil && len(*r.Title) > 200 {
		v.Add("title", "máximo 200 caracteres")
	}
	return v.Err()
}

type SendMessageRequest struct {
	Content string `json:"content"`
}

func (r SendMessageRequest) Validate() error {
	v := apperr.NewValidation()
	if c := strings.TrimSpace(r.Content); c == "" {
		v.Add("content", "requerido")
	} else if len(c) > 8000 {
		v.Add("content", "máximo 8000 caracteres")
	}
	return v.Err()
}
