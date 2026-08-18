package attachments

import (
	"context"
	"errors"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
)

// TestForeignUserGets404 confirms a user cannot reach another user's attachment.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	att, err := repo.Insert(ctx, alice, RegisterRequest{StoragePath: alice.String() + "/doc.pdf", FileName: "doc.pdf"})
	if err != nil {
		t.Fatalf("Alice could not register her attachment: %v", err)
	}

	if _, err := repo.Get(ctx, bob, att.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob got Alice's attachment (expected NOT_FOUND): %v", err)
	}
	if _, err := repo.Get(ctx, alice, att.ID); err != nil {
		t.Fatalf("Alice could not see her own attachment: %v", err)
	}
}
