// Package dbtest holds the shared setup for the repository integration tests that
// verify a foreign user is denied access (the safety net that offsets connecting
// with service_role). Tests using it skip when DATABASE_URL is unset.
package dbtest

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Setup connects to DATABASE_URL and seeds two users (alice, bob) via auth.users;
// the handle_new_user trigger creates their profiles. It registers cleanup that
// deletes the users (cascading to their rows) and closes the pool. It skips the
// test when there's no DATABASE_URL.
func Setup(t *testing.T) (pool *pgxpool.Pool, alice, bob uuid.UUID) {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("no DATABASE_URL: skipping integration test")
	}
	ctx := context.Background()
	p, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("could not connect: %v", err)
	}
	alice, bob = uuid.New(), uuid.New()
	for _, id := range []uuid.UUID{alice, bob} {
		if _, err := p.Exec(ctx,
			`insert into auth.users (id, email) values ($1, $2)`,
			id, id.String()+"@test.local"); err != nil {
			p.Close()
			t.Fatalf("could not seed user (missing NOT NULL columns in auth.users?): %v", err)
		}
	}
	t.Cleanup(func() {
		_, _ = p.Exec(ctx, `delete from auth.users where id = any($1)`, []uuid.UUID{alice, bob})
		p.Close()
	})
	return p, alice, bob
}
