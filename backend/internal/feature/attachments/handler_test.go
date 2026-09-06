package attachments

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

func (f fakeService) CreateUploadURL(context.Context, uuid.UUID, UploadURLRequest) (*UploadTarget, error) {
	return &UploadTarget{}, f.err
}
func (f fakeService) Register(context.Context, uuid.UUID, RegisterRequest) (*Attachment, error) {
	return &Attachment{}, f.err
}
func (f fakeService) Get(context.Context, uuid.UUID, uuid.UUID) (*Attachment, error) {
	return &Attachment{}, f.err
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
		{http.MethodPost, "/attachments/upload-url", false, UploadURLRequest{FileName: "a.pdf", MimeType: "application/pdf", SizeBytes: 1024}, http.StatusOK},
		{http.MethodPost, "/attachments", false, RegisterRequest{StoragePath: "u/x/a.pdf", FileName: "a.pdf"}, http.StatusCreated},
		{http.MethodGet, "/attachments/{id}", true, nil, http.StatusOK},
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
