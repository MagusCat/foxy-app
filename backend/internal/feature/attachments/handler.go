package attachments

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

type service interface {
	CreateUploadURL(ctx context.Context, userID uuid.UUID, req UploadURLRequest) (*UploadTarget, error)
	Register(ctx context.Context, userID uuid.UUID, req RegisterRequest) (*Attachment, error)
	Get(ctx context.Context, userID, id uuid.UUID) (*Attachment, error)
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodPost, Pattern: "/attachments/upload-url", Handler: httpx.HandleBody(http.StatusOK, s.CreateUploadURL)},
		{Method: http.MethodPost, Pattern: "/attachments", Handler: httpx.HandleBody(http.StatusCreated, s.Register)},
		{Method: http.MethodGet, Pattern: "/attachments/{id}", Handler: httpx.HandleID(http.StatusOK, s.Get)},
	}
}
