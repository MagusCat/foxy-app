package topics

import (
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/zones/{id}/topics", Handler: httpx.HandleID(http.StatusOK, s.List)},
		{Method: http.MethodPost, Pattern: "/zones/{id}/topics", Handler: httpx.HandleBodyID(http.StatusCreated, s.Create)},
		{Method: http.MethodPatch, Pattern: "/topics/{id}", Handler: httpx.HandleBodyID(http.StatusOK, s.Update)},
		{Method: http.MethodDelete, Pattern: "/topics/{id}", Handler: httpx.HandleDelete(s.Delete)},
	}
}
