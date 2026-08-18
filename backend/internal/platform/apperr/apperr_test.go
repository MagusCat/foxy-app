package apperr

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestValidationErr(t *testing.T) {
	if err := NewValidation().Err(); err != nil {
		t.Fatalf("validation with no errors must be nil, got %v", err)
	}
	err := NewValidation().Add("email", "inválido").Add("name", "requerido").Err()
	e := As(err)
	if e.Code != "VALIDATION_ERROR" || e.Status != http.StatusBadRequest {
		t.Fatalf("expected VALIDATION_ERROR/400, got %s/%d", e.Code, e.Status)
	}
	if len(e.Details) != 2 {
		t.Fatalf("expected 2 details, got %d", len(e.Details))
	}
}

func TestAsWrapsUnknownAsInternal(t *testing.T) {
	e := As(errors.New("boom"))
	if e.Code != "INTERNAL" || e.Status != http.StatusInternalServerError {
		t.Fatalf("unknown error must map to INTERNAL/500, got %s/%d", e.Code, e.Status)
	}
}

func TestIsMatchesThroughWrap(t *testing.T) {
	wrapped := ErrNotFound.Wrap(fmt.Errorf("no rows"))
	if !errors.Is(wrapped, ErrNotFound) {
		t.Fatal("a wrapped ErrNotFound must still match ErrNotFound")
	}
	if errors.Is(wrapped, ErrForbidden) {
		t.Fatal("must not match a different code")
	}
}

func TestStatusPerCode(t *testing.T) {
	cases := map[*Error]int{
		ErrUnauthenticated: 401, ErrForbidden: 403, ErrNotFound: 404,
		ErrConflict: 409, ErrPayloadTooLarge: 413, ErrRateLimited: 429,
		ErrAIUnavailable: 502, ErrInternal: 500,
	}
	for e, want := range cases {
		if e.Status != want {
			t.Errorf("%s: expected status %d, got %d", e.Code, want, e.Status)
		}
	}
}
