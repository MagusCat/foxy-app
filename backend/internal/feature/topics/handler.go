package topics

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

type service interface {
	List(ctx context.Context, userID, notebookID uuid.UUID) ([]Topic, error)
	Create(ctx context.Context, userID, notebookID uuid.UUID, req CreateTopicRequest) (*Topic, error)
	Update(ctx context.Context, userID, topicID uuid.UUID, req UpdateTopicRequest) (*Topic, error)
	Delete(ctx context.Context, userID, topicID uuid.UUID) error
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/notebooks/{id}/topics", Handler: httpx.HandleID(http.StatusOK, s.List)},
		{Method: http.MethodPost, Pattern: "/notebooks/{id}/topics", Handler: httpx.HandleBodyID(http.StatusCreated, s.Create)},
		{Method: http.MethodPatch, Pattern: "/topics/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.Update)},
		{Method: http.MethodDelete, Pattern: "/topics/{id}", Handler: httpx.HandleDelete(s.Delete)},
	}
}
