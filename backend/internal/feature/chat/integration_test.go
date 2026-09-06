package chat

import (
	"context"
	"errors"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
)

// TestForeignUserGets404 confirms a user cannot reach another user's conversation.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	conv, err := repo.CreateConversation(ctx, alice, nil, nil)
	if err != nil {
		t.Fatalf("Alice could not create her conversation: %v", err)
	}

	if _, err := repo.GetConversation(ctx, bob, conv.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob got Alice's conversation (expected NOT_FOUND): %v", err)
	}
	if err := repo.DeleteConversation(ctx, bob, conv.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob could delete Alice's conversation (expected NOT_FOUND): %v", err)
	}
	if _, err := repo.GetConversation(ctx, alice, conv.ID); err != nil {
		t.Fatalf("Alice could not see her own conversation: %v", err)
	}
}
