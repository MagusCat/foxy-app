package profile

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
)

// fakeService implements the `service` interface without touching the DB.
type fakeService struct {
	profile *Profile
	err     error
}

func (f fakeService) Get(context.Context, uuid.UUID) (*Profile, error) { return f.profile, f.err }
func (f fakeService) Update(context.Context, uuid.UUID, UpdateProfileRequest) (*Profile, error) {
	return f.profile, f.err
}
func (f fakeService) ListProfessions(context.Context) ([]Profession, error) { return nil, f.err }
func (f fakeService) CreateProfession(context.Context, string) (*Profession, error) {
	return nil, f.err
}

func reqWithUser(id uuid.UUID) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	return r.WithContext(reqctx.WithUser(r.Context(), reqctx.User{ID: id}))
}

// meHandler returns the GET /me handler built by Routes(), so the test exercises
// the same wiring production uses (helpers included), not a private method.
func meHandler(h *Handler) http.HandlerFunc {
	for _, rt := range h.Routes() {
		if rt.Method == http.MethodGet && rt.Pattern == "/me" {
			return rt.Handler
		}
	}
	panic("GET /me route not found")
}

func TestGetMeOK(t *testing.T) {
	uid := uuid.New()
	h := NewHandler(fakeService{profile: &Profile{ID: uid, SystemRole: "user"}})
	rec := httptest.NewRecorder()

	meHandler(h)(rec, reqWithUser(uid))

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var body struct {
		Data Profile `json:"data"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if body.Data.ID != uid {
		t.Fatalf("the envelope did not return the expected profile")
	}
}

func TestGetMeMapsNotFoundTo404(t *testing.T) {
	h := NewHandler(fakeService{err: apperr.ErrNotFound})
	rec := httptest.NewRecorder()

	meHandler(h)(rec, reqWithUser(uuid.New()))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.Error.Code != "NOT_FOUND" {
		t.Fatalf("expected code NOT_FOUND, got %q", body.Error.Code)
	}
}
