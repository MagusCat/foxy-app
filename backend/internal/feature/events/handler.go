package events

import (
	"context"
	"net/http"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

type service interface {
	List(ctx context.Context, userID uuid.UUID, from, to *time.Time, notebookID *uuid.UUID) ([]Event, error)
	Create(ctx context.Context, userID uuid.UUID, req CreateEventRequest) (*Event, error)
	Get(ctx context.Context, userID, id uuid.UUID) (*Event, error)
	Update(ctx context.Context, userID, id uuid.UUID, req UpdateEventRequest) (*Event, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/events", Handler: h.list},
		{Method: http.MethodPost, Pattern: "/events", Handler: httpx.HandleBody(http.StatusCreated, s.Create)},
		{Method: http.MethodGet, Pattern: "/events/{id}", Handler: httpx.HandleID(http.StatusOK, s.Get)},
		{Method: http.MethodPatch, Pattern: "/events/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.Update)},
		{Method: http.MethodDelete, Pattern: "/events/{id}", Handler: httpx.HandleDelete(s.Delete)},
	}
}

// list is custom (not httpx.Handle) because it reads the ?from=&to=&notebook_id=
// calendar-range filters from the query string.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid, err := httpx.RequireUser(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	notebookID, err := httpx.QueryUUID(r, "notebook_id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	from, err := queryTime(r, "from")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	to, err := queryTime(r, "to")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	list, err := h.svc.List(r.Context(), uid, from, to, notebookID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, r, http.StatusOK, list)
}

// queryTime parses an optional RFC3339 query parameter; absent means no filter.
func queryTime(r *http.Request, name string) (*time.Time, error) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return nil, apperr.NewValidation().Add(name, "debe ser una fecha RFC3339").Err()
	}
	return &t, nil
}
