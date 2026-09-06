package chat

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

func (f fakeService) ListConversations(context.Context, uuid.UUID, *uuid.UUID, *int16, string, int) ([]Conversation, string, error) {
	return []Conversation{}, "", f.err
}
func (f fakeService) CreateConversation(context.Context, uuid.UUID, CreateConversationRequest) (*Conversation, error) {
	return &Conversation{}, f.err
}
func (f fakeService) Conversation(context.Context, uuid.UUID, uuid.UUID) (*Conversation, error) {
	return &Conversation{}, f.err
}
func (f fakeService) DeleteConversation(context.Context, uuid.UUID, uuid.UUID) error { return f.err }
func (f fakeService) ListMessages(context.Context, uuid.UUID, uuid.UUID, string, int) ([]Message, string, error) {
	return []Message{}, "", f.err
}
func (f fakeService) ListSaved(context.Context, uuid.UUID, string, int) ([]Message, string, error) {
	return []Message{}, "", f.err
}
func (f fakeService) SetSaved(context.Context, uuid.UUID, uuid.UUID, bool) (*Message, error) {
	return &Message{}, f.err
}
func (f fakeService) StreamReply(_ context.Context, _ uuid.UUID, _ *Conversation, _ SendMessageRequest, onToken func(string)) (*Message, error) {
	if f.err != nil {
		return nil, f.err
	}
	onToken("hola")
	return &Message{}, nil
}

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
	return []endpoint{
		{http.MethodGet, "/conversations", false, nil, http.StatusOK},
		{http.MethodPost, "/conversations", false, CreateConversationRequest{}, http.StatusCreated},
		{http.MethodDelete, "/conversations/{id}", true, nil, http.StatusNoContent},
		{http.MethodGet, "/conversations/{id}/messages", true, nil, http.StatusOK},
		{http.MethodGet, "/messages", false, nil, http.StatusOK},
		{http.MethodPut, "/messages/{id}/saved", true, SetSavedRequest{Saved: true}, http.StatusOK},
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

// sendMessage responds over SSE, so it is exercised on its own: a token frame and
// a final done event on success, a JSON 404 before the stream when the
// conversation isn't the user's.
func TestSendMessageStreamsTokensAndDone(t *testing.T) {
	h := NewHandler(fakeService{})
	rec := do(route(t, h, http.MethodPost, "/conversations/{id}/messages"),
		uuid.New(), uuid.New().String(), SendMessageRequest{Content: "hola"})
	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !bytes.Contains([]byte(body), []byte("event: token")) || !bytes.Contains([]byte(body), []byte("event: done")) {
		t.Fatalf("expected token and done events, got: %s", body)
	}
}

func TestSendMessageOnAForeignConversationIs404(t *testing.T) {
	h := NewHandler(fakeService{err: apperr.ErrNotFound})
	rec := do(route(t, h, http.MethodPost, "/conversations/{id}/messages"),
		uuid.New(), uuid.New().String(), SendMessageRequest{Content: "hola"})
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 before streaming, got %d", rec.Code)
	}
}

func TestSendMessageRejectsAnInvalidBody(t *testing.T) {
	h := NewHandler(fakeService{})
	rec := do(route(t, h, http.MethodPost, "/conversations/{id}/messages"),
		uuid.New(), uuid.New().String(), SendMessageRequest{Content: "  "})
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty content, got %d", rec.Code)
	}
}
