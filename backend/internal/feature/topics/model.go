// Package topics handles the named topics that organize a notebook (chapters or
// subjects within it). Any member can list them; only the notebook owner can change
// them. Ownership is a row in notebook_members with role='owner'.
package topics

import (
	"time"

	"github.com/google/uuid"
)

const roleOwner = "owner"

type Topic struct {
	ID         uuid.UUID `db:"id" json:"id"`
	NotebookID uuid.UUID `db:"notebook_id" json:"notebook_id"`
	Name       string    `db:"name" json:"name"`
	Position   int       `db:"position" json:"position"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}
