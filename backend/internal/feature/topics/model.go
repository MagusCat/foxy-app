// Package topics handles the named topics that organize a study zone (chapters or
// subjects within it). Any member can list them; only the zone owner can change
// them. Ownership is a row in study_zone_members with role='owner'.
package topics

import (
	"time"

	"github.com/google/uuid"
)

const roleOwner = "owner"

type Topic struct {
	ID        uuid.UUID `db:"id" json:"id"`
	ZoneID    uuid.UUID `db:"zone_id" json:"zone_id"`
	Name      string    `db:"name" json:"name"`
	Position  int       `db:"position" json:"position"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
