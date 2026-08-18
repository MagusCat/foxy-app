package events

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
	"github.com/google/uuid"
)

// TestForeignUserGets404 confirms a user cannot reach another user's private event.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	ev, err := repo.Create(ctx, alice, CreateEventRequest{Title: "Examen de Alice", Kind: "exam", StartsAt: time.Now()})
	if err != nil {
		t.Fatalf("Alice could not create her event: %v", err)
	}

	if _, err := repo.Get(ctx, bob, ev.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob got Alice's private event (expected NOT_FOUND): %v", err)
	}
	if err := repo.Delete(ctx, bob, ev.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob could delete Alice's event (expected NOT_FOUND): %v", err)
	}
	if _, err := repo.Get(ctx, alice, ev.ID); err != nil {
		t.Fatalf("Alice could not see her own event: %v", err)
	}

	// Attaching a material Alice doesn't own must be NOT_FOUND (a clean 404), not a
	// foreign-key 500. Seed a material owned by Bob and have Alice try to link it.
	var bobMaterial uuid.UUID
	if err := pool.QueryRow(ctx,
		`insert into materials (user_id, type, title) values ($1, 'summary', 'M') returning id`,
		bob).Scan(&bobMaterial); err != nil {
		t.Fatalf("could not seed Bob's material: %v", err)
	}
	if _, err := repo.Create(ctx, alice,
		CreateEventRequest{Title: "Entrega", Kind: "due", StartsAt: time.Now(), MaterialID: &bobMaterial}); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Alice linked Bob's material (expected NOT_FOUND): %v", err)
	}
}
