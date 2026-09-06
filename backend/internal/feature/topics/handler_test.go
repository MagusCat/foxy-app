package topics

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
)

type fakeService struct{ err error }

func (f fakeService) List(context.Context, uuid.UUID, uuid.UUID) ([]Topic, error) {
	return []Topic{}, f.err
}
func (f fakeService) Create(context.Context, uuid.UUID, uuid.UUID, CreateTopicRequest) (*Topic, error) {
	return &Topic{}, f.err
}
func (f fakeService) Update(context.Context, uuid.UUID, uuid.UUID, UpdateTopicRequest) (*Topic, error) {
	return &Topic{}, f.err
}
func (f fakeService) Delete(context.Context, uuid.UUID, uuid.UUID) error { return f.err }

func route(t *testing.T, h *Handler, method, pattern string) http.HandlerFunc {
	t.Helper()
	for _, rt := range h.Routes() {
		if rt.Method == method && rt.Pattern == pattern {
			return rt.Handler
		}
	}
	t.Fatalf("route %s %s not found", method, pattern)
	return nil
}

func do(handler http.HandlerFunc, uid uuid.UUID, id string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	r := httptest.NewRequest(http.MethodGet, "/", &buf)
	r = r.WithContext(reqctx.WithUser(r.Context(), reqctx.User{ID: uid}))
	if id != "" {
		r.SetPathValue("id", id)
	}
	rec := httptest.NewRecorder()
	handler(rec, r)
	return rec
}

type endpoint struct {
	method, pattern string
	body            any
	okStatus        int
}

func endpoints() []endpoint {
	return []endpoint{
		{http.MethodGet, "/notebooks/{id}/topics", nil, http.StatusOK},
		{http.MethodPost, "/notebooks/{id}/topics", CreateTopicRequest{Name: "Capítulo 1"}, http.StatusCreated},
		{http.MethodPatch, "/topics/{id}", UpdateTopicRequest{}, http.StatusOK},
		{http.MethodDelete, "/topics/{id}", nil, http.StatusNoContent},
	}
}

func TestEndpointsReturnTheirSuccessStatus(t *testing.T) {
	h := NewHandler(fakeService{})
	uid, id := uuid.New(), uuid.New().String()
	for _, e := range endpoints() {
		t.Run(e.method+" "+e.pattern, func(t *testing.T) {
			rec := do(route(t, h, e.method, e.pattern), uid, id, e.body)
			if rec.Code != e.okStatus {
				t.Fatalf("expected %d, got %d (%s)", e.okStatus, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestEndpointsMapNotFoundTo404(t *testing.T) {
	h := NewHandler(fakeService{err: apperr.ErrNotFound})
	uid, id := uuid.New(), uuid.New().String()
	for _, e := range endpoints() {
		t.Run(e.method+" "+e.pattern, func(t *testing.T) {
			rec := do(route(t, h, e.method, e.pattern), uid, id, e.body)
			if rec.Code != http.StatusNotFound {
				t.Fatalf("expected 404, got %d", rec.Code)
			}
		})
	}
}

func TestEndpointsRequireAuthentication(t *testing.T) {
	h := NewHandler(fakeService{})
	for _, e := range endpoints() {
		t.Run(e.method+" "+e.pattern, func(t *testing.T) {
			var buf bytes.Buffer
			if e.body != nil {
				_ = json.NewEncoder(&buf).Encode(e.body)
			}
			r := httptest.NewRequest(http.MethodGet, "/", &buf)
			r.SetPathValue("id", uuid.New().String())
			rec := httptest.NewRecorder()
			route(t, h, e.method, e.pattern)(rec, r)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d", rec.Code)
			}
		})
	}
}
