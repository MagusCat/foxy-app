// Package reqctx stores and retrieves per-request values from context.Context:
// the request-id and the authenticated user. It is isolated so httpx, auth and
// middleware can share it without import cycles.
package reqctx

import (
	"context"

	"github.com/google/uuid"
)

type ctxKey int

const (
	keyRequestID ctxKey = iota
	keyUser
)

// User is the authenticated user extracted from the JWT (only what the app needs).
type User struct {
	ID uuid.UUID // "sub" claim from the Supabase token
}

func WithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, keyRequestID, id)
}

func RequestID(ctx context.Context) string {
	id, _ := ctx.Value(keyRequestID).(string)
	return id
}

func WithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, keyUser, u)
}

// UserFrom returns the user and whether it was present. The auth middleware
// guarantees it exists on protected routes, so handlers can assume it.
func UserFrom(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(keyUser).(User)
	return u, ok
}
