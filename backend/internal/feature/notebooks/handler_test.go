package notebooks

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

// fakeService implements the service interface without a DB. err, when set, is
// returned by every method so error mapping can be checked.
type fakeService struct{ err error }

func (f fakeService) List(context.Context, uuid.UUID) ([]Notebook, error) {
	return []Notebook{}, f.err
}
func (f fakeService) Create(context.Context, uuid.UUID, CreateNotebookRequest) (*Notebook, error) {
	return &Notebook{}, f.err
}
func (f fakeService) Get(context.Context, uuid.UUID, uuid.UUID) (*Notebook, error) {
	return &Notebook{}, f.err
}
func (f fakeService) Update(context.Context, uuid.UUID, uuid.UUID, UpdateNotebookRequest) (*Notebook, error) {
	return &Notebook{}, f.err
}
func (f fakeService) Delete(context.Context, uuid.UUID, uuid.UUID) error { return f.err }
func (f fakeService) Join(context.Context, uuid.UUID, string) (*Notebook, error) {
	return &Notebook{}, f.err
}
func (f fakeService) Leave(context.Context, uuid.UUID, uuid.UUID) error { return f.err }
func (f fakeService) Members(context.Context, uuid.UUID, uuid.UUID) ([]Member, error) {
	return []Member{}, f.err
}
func (f fakeService) ListObjectives(context.Context, uuid.UUID, uuid.UUID) ([]Objective, error) {
	return []Objective{}, f.err
}
func (f fakeService) CreateObjective(context.Context, uuid.UUID, uuid.UUID, CreateObjectiveRequest) (*Objective, error) {
	return &Objective{}, f.err
}
func (f fakeService) UpdateObjective(context.Context, uuid.UUID, uuid.UUID, UpdateObjectiveRequest) (*Objective, error) {
	return &Objective{}, f.err
}
func (f fakeService) DeleteObjective(context.Context, uuid.UUID, uuid.UUID) error { return f.err }
func (f fakeService) SetProgress(context.Context, uuid.UUID, uuid.UUID, int) (*Progress, error) {
	return &Progress{}, f.err
}

// route finds the handler registered for method+pattern in Routes().
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

// do builds a request with the user in context, the {id} path value, and a JSON
// body, then runs the handler.
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
	needsID         bool
	body            any
	okStatus        int
}

func endpoints() []endpoint {
	return []endpoint{
		{http.MethodGet, "/notebooks", false, nil, http.StatusOK},
		{http.MethodPost, "/notebooks", false, CreateNotebookRequest{Name: "Cálculo"}, http.StatusCreated},
		{http.MethodPost, "/notebooks/join", false, JoinNotebookRequest{Code: "AB12CD"}, http.StatusOK},
		{http.MethodGet, "/notebooks/{id}", true, nil, http.StatusOK},
		{http.MethodPatch, "/notebooks/{id}", true, UpdateNotebookRequest{}, http.StatusOK},
		{http.MethodDelete, "/notebooks/{id}", true, nil, http.StatusNoContent},
		{http.MethodGet, "/notebooks/{id}/members", true, nil, http.StatusOK},
		{http.MethodDelete, "/notebooks/{id}/members/me", true, nil, http.StatusNoContent},
		{http.MethodGet, "/notebooks/{id}/objectives", true, nil, http.StatusOK},
		{http.MethodPost, "/notebooks/{id}/objectives", true, CreateObjectiveRequest{Title: "Derivadas"}, http.StatusCreated},
		{http.MethodPatch, "/objectives/{id}", true, UpdateObjectiveRequest{}, http.StatusOK},
		{http.MethodDelete, "/objectives/{id}", true, nil, http.StatusNoContent},
		{http.MethodPut, "/objectives/{id}/progress", true, SetProgressRequest{ProgressPct: 50}, http.StatusOK},
	}
}

func TestEndpointsReturnTheirSuccessStatus(t *testing.T) {
	h := NewHandler(fakeService{})
	uid := uuid.New()
	id := uuid.New().String()
	for _, e := range endpoints() {
		t.Run(e.method+" "+e.pattern, func(t *testing.T) {
			pathID := ""
			if e.needsID {
				pathID = id
			}
			rec := do(route(t, h, e.method, e.pattern), uid, pathID, e.body)
			if rec.Code != e.okStatus {
				t.Fatalf("expected %d, got %d (%s)", e.okStatus, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestEndpointsMapNotFoundTo404(t *testing.T) {
	h := NewHandler(fakeService{err: apperr.ErrNotFound})
	uid := uuid.New()
	id := uuid.New().String()
	for _, e := range endpoints() {
		t.Run(e.method+" "+e.pattern, func(t *testing.T) {
			pathID := ""
			if e.needsID {
				pathID = id
			}
			rec := do(route(t, h, e.method, e.pattern), uid, pathID, e.body)
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
			if e.needsID {
				r.SetPathValue("id", uuid.New().String())
			}
			rec := httptest.NewRecorder()
			route(t, h, e.method, e.pattern)(rec, r)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401 without a user, got %d", rec.Code)
			}
		})
	}
}
