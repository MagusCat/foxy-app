// Package chat handles conversations and messages. Sending a message responds
// over SSE (token by token), bridging to the ai-service.
package chat

import (
	"time"

	"github.com/google/uuid"
)

// Message roles (message_role enum in the DB).
const (
	roleUser      = "user"
	roleAssistant = "assistant"
)

type Conversation struct {
	ID        uuid.UUID  `db:"id" json:"id"`
	UserID    uuid.UUID  `db:"user_id" json:"user_id"`
	ZoneID    *uuid.UUID `db:"zone_id" json:"zone_id"`
	Title     *string    `db:"title" json:"title"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt time.Time  `db:"updated_at" json:"updated_at"`
}

type Message struct {
	ID             uuid.UUID `db:"id" json:"id"`
	ConversationID uuid.UUID `db:"conversation_id" json:"conversation_id"`
	Role           string    `db:"role" json:"role"`
	Content        string    `db:"content" json:"content"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}
