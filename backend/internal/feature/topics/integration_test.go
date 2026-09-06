package topics

import (
	"context"
	"errors"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
	"github.com/google/uuid"
)

// TestForeignUserGets404 confirms a non-member can't read a notebook's topics and a
// non-owner can't modify them.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	// Seed a notebook owned by Alice (ownership = a member row with role='owner').
	notebookID := uuid.New()
	if _, err := pool.Exec(ctx, `insert into notebooks (id, name) values ($1, 'Zona')`, notebookID); err != nil {
		t.Fatalf("could not seed notebook: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`insert into notebook_members (notebook_id, user_id, role) values ($1, $2, 'owner')`, notebookID, alice); err != nil {
		t.Fatalf("could not seed membership: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `delete from notebooks where id = $1`, notebookID) })

	top, err := repo.Create(ctx, alice, notebookID, CreateTopicRequest{Name: "Álgebra"})
	if err != nil {
		t.Fatalf("Alice (owner) could not create a topic: %v", err)
	}

	// Bob is not a member: listing the notebook's topics must be NOT_FOUND.
	if _, err := repo.List(ctx, bob, notebookID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob listed a notebook he isn't in (expected NOT_FOUND): %v", err)
	}
	// Bob is not the owner: modifying a topic must be NOT_FOUND.
	if err := repo.Delete(ctx, bob, top.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob deleted a topic he doesn't own (expected NOT_FOUND): %v", err)
	}
	// Alice (member+owner) can.
	if _, err := repo.List(ctx, alice, notebookID); err != nil {
		t.Fatalf("Alice could not list her notebook's topics: %v", err)
	}
}
