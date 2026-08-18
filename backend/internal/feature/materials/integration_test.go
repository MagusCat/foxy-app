package materials

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
)

// TestForeignUserGets404 confirms a user cannot reach another user's material.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	// Every type the API accepts must satisfy the DB CHECK: insert one of each so a
	// future drift between validTypes and the constraint fails here, not in prod.
	for mType := range validTypes {
		if _, err := repo.Insert(ctx, alice, nil, nil, mType, "T", json.RawMessage(`{}`)); err != nil {
			t.Fatalf("validTypes[%q] violates the materials.type CHECK: %v", mType, err)
		}
	}

	mat, err := repo.Insert(ctx, alice, nil, nil, TypeSummary, "Resumen de Alice", json.RawMessage(`{}`))
	if err != nil {
		t.Fatalf("Alice could not create her material: %v", err)
	}

	if _, err := repo.Get(ctx, bob, mat.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob got Alice's material (expected NOT_FOUND): %v", err)
	}
	if err := repo.Delete(ctx, bob, mat.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob could delete Alice's material (expected NOT_FOUND): %v", err)
	}
	if _, err := repo.Get(ctx, alice, mat.ID); err != nil {
		t.Fatalf("Alice could not see her own material: %v", err)
	}
}
