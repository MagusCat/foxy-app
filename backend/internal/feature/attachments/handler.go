package attachments

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
		{Method: http.MethodPost, Pattern: "/attachments/upload-url", Handler: httpx.HandleBody(http.StatusOK, s.CreateUploadURL)},
		{Method: http.MethodPost, Pattern: "/attachments", Handler: httpx.HandleBody(http.StatusCreated, s.Register)},
		{Method: http.MethodGet, Pattern: "/attachments/{id}", Handler: httpx.HandleID(http.StatusOK, s.Get)},
	}
}
