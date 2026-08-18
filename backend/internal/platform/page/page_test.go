package page

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCursorRoundTrip(t *testing.T) {
	id := uuid.New()
	now := time.Now().UTC().Truncate(time.Microsecond) // Postgres stores microseconds
	raw := Encode(now, id)

	c, err := Decode(raw)
	if err != nil {
		t.Fatalf("Decode failed: %v", err)
	}
	if c.ID != id || !c.T.Equal(now) {
		t.Fatalf("roundtrip lost data: got (%v,%v), expected (%v,%v)", c.T, c.ID, now, id)
	}
}

func TestDecodeEmptyIsFirstPage(t *testing.T) {
	c, err := Decode("")
	if err != nil || c != nil {
		t.Fatalf("empty cursor must yield (nil,nil), got (%v,%v)", c, err)
	}
}

func TestDecodeGarbageIsBadCursor(t *testing.T) {
	if _, err := Decode("!!!not-base64!!!"); err == nil {
		t.Fatal("a corrupt cursor must return an error")
	}
}

func TestArgsNil(t *testing.T) {
	var c *Cursor
	if t1, id := c.Args(); t1 != nil || id != nil {
		t.Fatalf("nil cursor must yield args (nil,nil), got (%v,%v)", t1, id)
	}
}
