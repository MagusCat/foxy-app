package httpx

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
)

// The helpers below remove the decode/user/path/error skeleton every handler
// repeated. Each extracts the authenticated user (401 if absent — closing the
// gap left by handlers that ignored the ok bool), optionally decodes the body
// and the {id} path param, runs fn, and writes the result or the error.

// RequireUser returns the authenticated user's id, or ErrUnauthenticated if the
// auth middleware didn't run. Custom handlers (streaming, pagination) use it.
func RequireUser(r *http.Request) (uuid.UUID, error) {
	u, ok := reqctx.UserFrom(r.Context())
	if !ok {
		return uuid.Nil, apperr.ErrUnauthenticated
	}
	return u.ID, nil
}

// Handle: authenticated user only, writes fn's result at status.
func Handle[Res any](status int, fn func(context.Context, uuid.UUID) (Res, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, err := RequireUser(r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		res, err := fn(r.Context(), uid)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		WriteJSON(w, r, status, res)
	}
}

// HandleBody: user + validated JSON body.
func HandleBody[Req Validator, Res any](status int, fn func(context.Context, uuid.UUID, Req) (Res, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, err := Decode[Req](w, r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		uid, err := RequireUser(r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		res, err := fn(r.Context(), uid, req)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		WriteJSON(w, r, status, res)
	}
}

// HandleID: user + {id} path param.
func HandleID[Res any](status int, fn func(context.Context, uuid.UUID, uuid.UUID) (Res, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, err := RequireUser(r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		id, err := PathUUID(r, "id")
		if err != nil {
			WriteError(w, r, err)
			return
		}
		res, err := fn(r.Context(), uid, id)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		WriteJSON(w, r, status, res)
	}
}

// HandleBodyID: user + {id} + validated JSON body.
func HandleBodyID[Req Validator, Res any](status int, fn func(context.Context, uuid.UUID, uuid.UUID, Req) (Res, error)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req, err := Decode[Req](w, r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		uid, err := RequireUser(r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		id, err := PathUUID(r, "id")
		if err != nil {
			WriteError(w, r, err)
			return
		}
		res, err := fn(r.Context(), uid, id, req)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		WriteJSON(w, r, status, res)
	}
}

// HandleDelete: user + {id}, replies 204 No Content on success.
func HandleDelete(fn func(context.Context, uuid.UUID, uuid.UUID) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		uid, err := RequireUser(r)
		if err != nil {
			WriteError(w, r, err)
			return
		}
		id, err := PathUUID(r, "id")
		if err != nil {
			WriteError(w, r, err)
			return
		}
		if err := fn(r.Context(), uid, id); err != nil {
			WriteError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
