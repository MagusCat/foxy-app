package profile

import (
	"context"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/google/uuid"
)

// service is what the handler needs from the domain. Defining the interface here
// (at the consumer) lets us test the handler with a fake, without a DB.
type service interface {
	Get(ctx context.Context, id uuid.UUID) (*Profile, error)
	Update(ctx context.Context, id uuid.UUID, req UpdateProfileRequest) (*Profile, error)
	ListProfessions(ctx context.Context) ([]Profession, error)
	CreateProfession(ctx context.Context, name string) (*Profession, error)
	ListSubjects(ctx context.Context, userID uuid.UUID) ([]Subject, error)
}

type Handler struct {
	svc service
}

func NewHandler(svc service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	s := h.svc
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/me", Handler: httpx.Handle(http.StatusOK, s.Get)},
		{Method: http.MethodPatch, Pattern: "/me", Handler: httpx.HandleBody(http.StatusOK, s.Update)},
		{Method: http.MethodGet, Pattern: "/professions", Handler: httpx.Handle(http.StatusOK,
			func(ctx context.Context, _ uuid.UUID) ([]Profession, error) {
				return s.ListProfessions(ctx)
			})},
		{Method: http.MethodPost, Pattern: "/professions", Handler: httpx.HandleBody(http.StatusCreated,
			func(ctx context.Context, _ uuid.UUID, req CreateProfessionRequest) (*Profession, error) {
				return s.CreateProfession(ctx, req.Name)
			})},
		{Method: http.MethodGet, Pattern: "/subjects", Handler: httpx.Handle(http.StatusOK, s.ListSubjects)},
	}
}
