package zones

import (
	"context"
	"errors"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
)

// TestForeignUserGets404 is the safety net that offsets the choice of service_role:
// since Go bypasses RLS, security depends on EVERY query filtering by user_id.
// This verifies it end to end against a real DB.
//
// Run with:  DATABASE_URL=postgresql://... go test ./internal/feature/zones/ -run Foreign
// It is skipped when there's no DATABASE_URL.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	z, err := repo.Create(ctx, alice, CreateZoneRequest{Name: "Zona de Alice"}, nil)
	if err != nil {
		t.Fatalf("Alice could not create her zone: %v", err)
	}

	// Bob must not be able to see or delete it.
	if _, err := repo.Get(ctx, bob, z.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob got Alice's zone (expected NOT_FOUND): %v", err)
	}
	if err := repo.Delete(ctx, bob, z.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob could delete Alice's zone (expected NOT_FOUND): %v", err)
	}

	// Alice can.
	if _, err := repo.Get(ctx, alice, z.ID); err != nil {
		t.Fatalf("Alice could not see her own zone: %v", err)
	}
}
