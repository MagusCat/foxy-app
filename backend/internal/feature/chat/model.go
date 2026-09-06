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

// Conversation kinds (conversations.kind CHECK).
const (
	kindAI    = "ai"
	kindGroup = "group"
)

var convKinds = map[string]bool{kindAI: true, kindGroup: true}

// Answer modes (messages.mode CHECK). Travels to the AI prompt.
var msgModes = map[string]bool{"respuesta": true, "pasos": true, "quiz": true}

type Conversation struct {
	ID         uuid.UUID  `db:"id" json:"id"`
	UserID     uuid.UUID  `db:"user_id" json:"user_id"`
	NotebookID *uuid.UUID `db:"notebook_id" json:"notebook_id"`
	SubjectID  *int16     `db:"subject_id" json:"subject_id"`
	Kind       string     `db:"kind" json:"kind"`
	Title      *string    `db:"title" json:"title"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `db:"updated_at" json:"updated_at"`
}

type Message struct {
	ID             uuid.UUID  `db:"id" json:"id"`
	ConversationID uuid.UUID  `db:"conversation_id" json:"conversation_id"`
	SenderID       *uuid.UUID `db:"sender_id" json:"sender_id"`
	Role           string     `db:"role" json:"role"`
	Content        string     `db:"content" json:"content"`
	Saved          bool       `db:"saved" json:"saved"`
	Mode           *string    `db:"mode" json:"mode"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
}
