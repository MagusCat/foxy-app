// Package page implements keyset (cursor) pagination by (timestamp, id).
// Keyset instead of OFFSET: it doesn't degrade as the table grows.
package page

import (
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

type Cursor struct {
	T  time.Time `json:"t"`
	ID uuid.UUID `json:"id"`
}

func Encode(t time.Time, id uuid.UUID) string {
	b, _ := json.Marshal(Cursor{T: t, ID: id})
	return base64.RawURLEncoding.EncodeToString(b)
}

// Decode returns (nil, nil) when empty (first page).
func Decode(raw string) (*Cursor, error) {
	if raw == "" {
		return nil, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return nil, BadCursor()
	}
	var c Cursor
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, BadCursor()
	}
	return &c, nil
}

// Args returns (t, id) for the keyset placeholders, or (nil, nil).
func (c *Cursor) Args() (any, any) {
	if c == nil {
		return nil, nil
	}
	return c.T, c.ID
}

func BadCursor() error {
	return apperr.NewValidation().Add("cursor", "cursor inválido").Err()
}

// Slice trims a keyset page fetched with `limit+1`: if the extra row came back
// there are more pages, so it drops that row and returns the cursor pointing at
// the last kept item. cursorOf builds the cursor from a row.
func Slice[T any](rows []T, limit int, cursorOf func(T) string) (items []T, next string) {
	if len(rows) > limit {
		rows = rows[:limit]
		next = cursorOf(rows[limit-1])
	}
	return rows, next
}
