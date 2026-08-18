package zones

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/zones", Handler: httpx.Handle(http.StatusOK, s.List)},
		{Method: http.MethodPost, Pattern: "/zones", Handler: httpx.HandleBody(http.StatusCreated, s.Create)},
		{Method: http.MethodPost, Pattern: "/zones/join", Handler: httpx.HandleBody(http.StatusOK,
			func(ctx context.Context, uid uuid.UUID, req JoinZoneRequest) (*Zone, error) {
				return s.Join(ctx, uid, req.Code)
			})},
		{Method: http.MethodGet, Pattern: "/zones/{id}", Handler: httpx.HandleID(http.StatusOK, s.Get)},
		{Method: http.MethodPatch, Pattern: "/zones/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.Update)},
		{Method: http.MethodDelete, Pattern: "/zones/{id}", Handler: httpx.HandleDelete(s.Delete)},
		{Method: http.MethodGet, Pattern: "/zones/{id}/members", Handler: httpx.HandleID(http.StatusOK, s.Members)},
		{Method: http.MethodDelete, Pattern: "/zones/{id}/members/me", Handler: httpx.HandleDelete(s.Leave)},
		{Method: http.MethodGet, Pattern: "/zones/{id}/objectives", Handler: httpx.HandleID(http.StatusOK, s.ListObjectives)},
		{Method: http.MethodPost, Pattern: "/zones/{id}/objectives", Handler: httpx.HandleBodyID(http.StatusCreated, s.CreateObjective)},
		{Method: http.MethodPatch, Pattern: "/objectives/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.UpdateObjective)},
		{Method: http.MethodDelete, Pattern: "/objectives/{id}", Handler: httpx.HandleDelete(s.DeleteObjective)},
		{Method: http.MethodPut, Pattern: "/objectives/{id}/progress", Handler: httpx.HandleBodyID(http.StatusOK,
			func(ctx context.Context, uid, objID uuid.UUID, req SetProgressRequest) (*Progress, error) {
				return s.SetProgress(ctx, uid, objID, req.ProgressPct)
			})},
	}
}
