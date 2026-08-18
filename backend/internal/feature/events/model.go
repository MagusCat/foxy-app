// Package events handles the user's calendar: classes, exams, deadlines, study
// sessions and reminders. An event with a zone_id is visible to the whole zone;
// without one it is private to its owner.
package events

import (
	"time"

	"github.com/google/uuid"
)

// eventKinds are the allowed values of events.kind (mirrors the DB CHECK).
var eventKinds = map[string]bool{
	"class": true, "exam": true, "due": true, "session": true, "reminder": true,
}

type Event struct {
	ID         uuid.UUID  `db:"id" json:"id"`
	UserID     uuid.UUID  `db:"user_id" json:"user_id"`
	ZoneID     *uuid.UUID `db:"zone_id" json:"zone_id"`
	MaterialID *uuid.UUID `db:"material_id" json:"material_id"`
	Title      string     `db:"title" json:"title"`
	Kind       string     `db:"kind" json:"kind"`
	StartsAt   time.Time  `db:"starts_at" json:"starts_at"`
	EndsAt     *time.Time `db:"ends_at" json:"ends_at"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
}
