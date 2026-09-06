package materials

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

const (
	defaultListLimit = 20
	maxListLimit     = 50
)

type service interface {
	Generate(ctx context.Context, userID uuid.UUID, req GenerateRequest) (*Material, error)
	List(ctx context.Context, userID uuid.UUID, notebookID *uuid.UUID, mType *string, rawCursor string, limit int) ([]Material, string, error)
	Get(ctx context.Context, userID, id uuid.UUID) (*Material, error)
	Delete(ctx context.Context, userID, id uuid.UUID) error
	StartAttempt(ctx context.Context, userID, materialID uuid.UUID) (*Attempt, error)
	SubmitAttempt(ctx context.Context, userID, attemptID uuid.UUID, req SubmitAttemptRequest) (*Attempt, error)
	ListAttempts(ctx context.Context, userID, materialID uuid.UUID) ([]Attempt, error)
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		// generate calls the AI -> Paid (rate-limit).
		{Method: http.MethodPost, Pattern: "/materials/generate", Handler: httpx.HandleBody(http.StatusCreated, s.Generate), Paid: true},
		{Method: http.MethodGet, Pattern: "/materials", Handler: h.list},
		{Method: http.MethodGet, Pattern: "/materials/{id}", Handler: httpx.HandleID(http.StatusOK, s.Get)},
		{Method: http.MethodDelete, Pattern: "/materials/{id}", Handler: httpx.HandleDelete(s.Delete)},
		{Method: http.MethodPost, Pattern: "/materials/{id}/attempts", Handler: httpx.HandleID(http.StatusCreated, s.StartAttempt)},
		{Method: http.MethodGet, Pattern: "/materials/{id}/attempts", Handler: httpx.HandleID(http.StatusOK, s.ListAttempts)},
		{Method: http.MethodPatch, Pattern: "/attempts/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.SubmitAttempt)},
	}
}

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
	var mType *string
	if t := r.URL.Query().Get("type"); t != "" {
		mType = &t
	}
	limit := httpx.QueryInt(r, "limit", defaultListLimit, maxListLimit)
	list, next, err := h.svc.List(r.Context(), uid, notebookID, mType, r.URL.Query().Get("cursor"), limit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WritePage(w, r, list, next)
}
