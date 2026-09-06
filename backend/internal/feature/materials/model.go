// Package materials handles AI-generated material (plans, flashcards, exams...)
// and exam attempts. Each type's specific content lives in content (jsonb): a new
// type doesn't change the schema.
package materials

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

// Material types — mirror the materials.type CHECK in the DB. Adding one here
// means editing that CHECK too; contract_test.go falla si divergen.
const (
	TypeSummary    = "summary"
	TypeFlashcards = "flashcards"
	TypeExam       = "exam"
	TypeAssignment = "assignment"
	TypeNotes      = "notes"
	TypeLessonText = "lesson_text"
	TypeTrueFalse  = "true_false"
	TypeExercise   = "exercise"
	TypeWeakAreas  = "weak_areas"
)

var validTypes = map[string]bool{
	TypeSummary: true, TypeFlashcards: true, TypeExam: true,
	TypeAssignment: true, TypeNotes: true,
	TypeLessonText: true, TypeTrueFalse: true,
	TypeExercise: true, TypeWeakAreas: true,
}

const maxPromptLen = 4000

type Material struct {
	ID             uuid.UUID       `db:"id" json:"id"`
	UserID         uuid.UUID       `db:"user_id" json:"user_id"`
	NotebookID     *uuid.UUID      `db:"notebook_id" json:"notebook_id"`
	ConversationID *uuid.UUID      `db:"conversation_id" json:"conversation_id"`
	Type           string          `db:"type" json:"type"`
	Title          string          `db:"title" json:"title"`
	Content        json.RawMessage `db:"content" json:"content"`
	CreatedAt      time.Time       `db:"created_at" json:"created_at"`
}

type Attempt struct {
	ID          uuid.UUID       `db:"id" json:"id"`
	MaterialID  uuid.UUID       `db:"material_id" json:"material_id"`
	UserID      uuid.UUID       `db:"user_id" json:"user_id"`
	StartedAt   time.Time       `db:"started_at" json:"started_at"`
	SubmittedAt *time.Time      `db:"submitted_at" json:"submitted_at"`
	Score       *float64        `db:"score" json:"score"`
	Answers     json.RawMessage `db:"answers" json:"answers"`
}

// GenerateRequest asks the AI for a new material.
type GenerateRequest struct {
	Type           string     `json:"type"`
	NotebookID     *uuid.UUID `json:"notebook_id"`
	ConversationID *uuid.UUID `json:"conversation_id"`
	Title          *string    `json:"title"`
	Prompt         string     `json:"prompt"`
}

func (r GenerateRequest) Validate() error {
	v := apperr.NewValidation()
	if !validTypes[r.Type] {
		v.Add("type", "tipo de material no soportado")
	}
	if strings.TrimSpace(r.Prompt) == "" {
		v.Add("prompt", "requerido")
	} else if len(r.Prompt) > maxPromptLen {
		v.Add("prompt", "máximo 4000 caracteres")
	}
	return v.Err()
}

// SubmitAttemptRequest submits the answers of an attempt.
type SubmitAttemptRequest struct {
	Answers json.RawMessage `json:"answers"`
	Score   *float64        `json:"score"`
}

func (r SubmitAttemptRequest) Validate() error {
	v := apperr.NewValidation()
	if len(r.Answers) == 0 || !json.Valid(r.Answers) {
		v.Add("answers", "requerido, debe ser JSON válido")
	}
	if r.Score != nil && (*r.Score < 0 || *r.Score > 100) {
		v.Add("score", "debe estar entre 0 y 100")
	}
	return v.Err()
}

// defaultTitle provides a title when the user doesn't send one.
func defaultTitle(materialType string) string {
	switch materialType {
	case TypeSummary:
		return "Resumen"
	case TypeFlashcards:
		return "Tarjetas de memoria"
	case TypeExam:
		return "Examen"
	case TypeAssignment:
		return "Tarea"
	case TypeNotes:
		return "Apuntes"
	case TypeLessonText:
		return "Lección"
	case TypeTrueFalse:
		return "Verdadero o falso"
	case TypeExercise:
		return "Ejercicio"
	case TypeWeakAreas:
		return "Áreas de mejora"
	default:
		return "Material"
	}
}
