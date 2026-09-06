// Package auth validates the JWT issued by Supabase Auth. The backend never
// stores a signing secret: it downloads the project's public key from the JWKS
// (ES256) and verifies tokens with it. keyfunc caches and rotates the JWKS itself.
package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type Authenticator struct {
	kf     keyfunc.Keyfunc
	issuer string
}

// New downloads the JWKS and prepares the validator. Its refresh is tied to ctx.
func New(ctx context.Context, jwksURL, issuer string) (*Authenticator, error) {
	kf, err := keyfunc.NewDefaultCtx(ctx, []string{jwksURL})
	if err != nil {
		return nil, err
	}
	return &Authenticator{kf: kf, issuer: issuer}, nil
}

// Middleware requires a valid Bearer token and puts the user in the context. Any
// missing, expired, or badly signed token stops with a 401.
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok || raw == "" {
			httpx.WriteError(w, r, apperr.ErrUnauthenticated)
			return
		}
		user, err := a.parse(raw)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		next.ServeHTTP(w, r.WithContext(reqctx.WithUser(r.Context(), user)))
	})
}

func (a *Authenticator) parse(raw string) (reqctx.User, error) {
	token, err := jwt.Parse(raw, a.kf.Keyfunc,
		jwt.WithValidMethods([]string{"ES256"}), // don't accept 'none' or HS256
		jwt.WithIssuer(a.issuer),
		jwt.WithAudience("authenticated"),
		jwt.WithExpirationRequired(),
	)
	if err != nil || !token.Valid {
		return reqctx.User{}, apperr.ErrUnauthenticated
	}
	sub, err := token.Claims.GetSubject()
	if err != nil {
		return reqctx.User{}, apperr.ErrUnauthenticated
	}
	uid, err := uuid.Parse(sub)
	if err != nil {
		return reqctx.User{}, apperr.ErrUnauthenticated
	}
	return reqctx.User{ID: uid}, nil
}
