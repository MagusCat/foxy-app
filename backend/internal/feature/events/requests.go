package events

import (
	"strings"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

type CreateEventRequest struct {
	ZoneID     *uuid.UUID `json:"zone_id"`     // nil = private event
	MaterialID *uuid.UUID `json:"material_id"` // nil = not tied to a material
	Title      string     `json:"title"`
	Kind       string     `json:"kind"`
	StartsAt   time.Time  `json:"starts_at"`
	EndsAt     *time.Time `json:"ends_at"`
}

func (r CreateEventRequest) Validate() error {
	v := apperr.NewValidation()
	if t := strings.TrimSpace(r.Title); t == "" || len(t) > 200 {
		v.Add("title", "requerido, máximo 200 caracteres")
	}
	if !eventKinds[r.Kind] {
		v.Add("kind", "debe ser class, exam, due, session o reminder")
	}
	if r.StartsAt.IsZero() {
		v.Add("starts_at", "requerido")
	}
	if r.EndsAt != nil && r.EndsAt.Before(r.StartsAt) {
		v.Add("ends_at", "no puede ser anterior a starts_at")
	}
	return v.Err()
}

// UpdateEventRequest patches only the time/label fields. zone_id and material_id
// aren't editable: moving an event between zones is a delete + create, which keeps
// the visibility change explicit. Pointers distinguish "absent" from "empty".
type UpdateEventRequest struct {
	Title    *string    `json:"title"`
	Kind     *string    `json:"kind"`
	StartsAt *time.Time `json:"starts_at"`
	EndsAt   *time.Time `json:"ends_at"`
}

func (r UpdateEventRequest) Validate() error {
	v := apperr.NewValidation()
	if r.Title != nil && (strings.TrimSpace(*r.Title) == "" || len(*r.Title) > 200) {
		v.Add("title", "no puede ser vacío, máximo 200 caracteres")
	}
	if r.Kind != nil && !eventKinds[*r.Kind] {
		v.Add("kind", "debe ser class, exam, due, session o reminder")
	}
	// starts_at/ends_at coherence is enforced by the DB CHECK when only one side
	// is patched; validating both here isn't possible without the stored row.
	if r.StartsAt != nil && r.EndsAt != nil && r.EndsAt.Before(*r.StartsAt) {
		v.Add("ends_at", "no puede ser anterior a starts_at")
	}
	return v.Err()
}
