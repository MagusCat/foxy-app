package events

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
)

type fakeService struct{ err error }

func (f fakeService) List(context.Context, uuid.UUID, *time.Time, *time.Time, *uuid.UUID) ([]Event, error) {
	return []Event{}, f.err
}
func (f fakeService) Create(context.Context, uuid.UUID, CreateEventRequest) (*Event, error) {
	return &Event{}, f.err
}
func (f fakeService) Get(context.Context, uuid.UUID, uuid.UUID) (*Event, error) {
	return &Event{}, f.err
}
func (f fakeService) Update(context.Context, uuid.UUID, uuid.UUID, UpdateEventRequest) (*Event, error) {
	return &Event{}, f.err
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
	needsID         bool
	body            any
	okStatus        int
}

func endpoints() []endpoint {
	now := time.Now()
	return []endpoint{
		{http.MethodGet, "/events", false, nil, http.StatusOK},
		{http.MethodPost, "/events", false, CreateEventRequest{Title: "Examen", Kind: "exam", StartsAt: now}, http.StatusCreated},
		{http.MethodGet, "/events/{id}", true, nil, http.StatusOK},
		{http.MethodPatch, "/events/{id}", true, UpdateEventRequest{}, http.StatusOK},
		{http.MethodDelete, "/events/{id}", true, nil, http.StatusNoContent},
	}
}

func TestEndpointsReturnTheirSuccessStatus(t *testing.T) {
	h := NewHandler(fakeService{})
	uid, id := uuid.New(), uuid.New().String()
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
	uid, id := uuid.New(), uuid.New().String()
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
				t.Fatalf("expected 401, got %d", rec.Code)
			}
		})
	}
}

func TestListRejectsAMalformedDateFilter(t *testing.T) {
	h := NewHandler(fakeService{})
	r := httptest.NewRequest(http.MethodGet, "/?from=not-a-date", nil)
	r = r.WithContext(reqctx.WithUser(r.Context(), reqctx.User{ID: uuid.New()}))
	rec := httptest.NewRecorder()
	route(t, h, http.MethodGet, "/events")(rec, r)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for a bad date, got %d", rec.Code)
	}
}
