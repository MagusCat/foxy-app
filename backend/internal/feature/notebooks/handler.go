package notebooks

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

// service is what the handler needs from the domain. Declared at the consumer so
// the handler can be tested with a fake, without a DB.
type service interface {
	List(ctx context.Context, userID uuid.UUID) ([]Notebook, error)
	Create(ctx context.Context, userID uuid.UUID, req CreateNotebookRequest) (*Notebook, error)
	Get(ctx context.Context, userID, notebookID uuid.UUID) (*Notebook, error)
	Update(ctx context.Context, userID, notebookID uuid.UUID, req UpdateNotebookRequest) (*Notebook, error)
	Delete(ctx context.Context, userID, notebookID uuid.UUID) error
	Join(ctx context.Context, userID uuid.UUID, code string) (*Notebook, error)
	Leave(ctx context.Context, userID, notebookID uuid.UUID) error
	Members(ctx context.Context, userID, notebookID uuid.UUID) ([]Member, error)
	ListObjectives(ctx context.Context, userID, notebookID uuid.UUID) ([]Objective, error)
	CreateObjective(ctx context.Context, userID, notebookID uuid.UUID, req CreateObjectiveRequest) (*Objective, error)
	UpdateObjective(ctx context.Context, userID, objID uuid.UUID, req UpdateObjectiveRequest) (*Objective, error)
	DeleteObjective(ctx context.Context, userID, objID uuid.UUID) error
	SetProgress(ctx context.Context, userID, objID uuid.UUID, pct int) (*Progress, error)
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/notebooks", Handler: httpx.Handle(http.StatusOK, s.List)},
		{Method: http.MethodPost, Pattern: "/notebooks", Handler: httpx.HandleBody(http.StatusCreated, s.Create)},
		{Method: http.MethodPost, Pattern: "/notebooks/join", Handler: httpx.HandleBody(http.StatusOK,
			func(ctx context.Context, uid uuid.UUID, req JoinNotebookRequest) (*Notebook, error) {
				return s.Join(ctx, uid, req.Code)
			})},
		{Method: http.MethodGet, Pattern: "/notebooks/{id}", Handler: httpx.HandleID(http.StatusOK, s.Get)},
		{Method: http.MethodPatch, Pattern: "/notebooks/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.Update)},
		{Method: http.MethodDelete, Pattern: "/notebooks/{id}", Handler: httpx.HandleDelete(s.Delete)},
		{Method: http.MethodGet, Pattern: "/notebooks/{id}/members", Handler: httpx.HandleID(http.StatusOK, s.Members)},
		{Method: http.MethodDelete, Pattern: "/notebooks/{id}/members/me", Handler: httpx.HandleDelete(s.Leave)},
		{Method: http.MethodGet, Pattern: "/notebooks/{id}/objectives", Handler: httpx.HandleID(http.StatusOK, s.ListObjectives)},
		{Method: http.MethodPost, Pattern: "/notebooks/{id}/objectives", Handler: httpx.HandleBodyID(http.StatusCreated, s.CreateObjective)},
		{Method: http.MethodPatch, Pattern: "/objectives/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.UpdateObjective)},
		{Method: http.MethodDelete, Pattern: "/objectives/{id}", Handler: httpx.HandleDelete(s.DeleteObjective)},
		{Method: http.MethodPut, Pattern: "/objectives/{id}/progress", Handler: httpx.HandleBodyID(http.StatusOK,
			func(ctx context.Context, uid, objID uuid.UUID, req SetProgressRequest) (*Progress, error) {
				return s.SetProgress(ctx, uid, objID, req.ProgressPct)
			})},
	}
}
