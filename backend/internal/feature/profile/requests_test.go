package profile

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
)

func ptr[T any](v T) *T { return &v }

func TestUpdateProfileValidate(t *testing.T) {
	long := strings.Repeat("x", 81)
	cases := []struct {
		name    string
		req     UpdateProfileRequest
		wantErr bool
	}{
		{"empty is valid (PATCH)", UpdateProfileRequest{}, false},
		{"display_name too long", UpdateProfileRequest{DisplayName: &long}, true},
		{"invalid academic_level", UpdateProfileRequest{AcademicLevel: ptr("colegio")}, true},
		{"valid academic_level", UpdateProfileRequest{AcademicLevel: ptr("universidad")}, false},
		{"new academic_level primaria", UpdateProfileRequest{AcademicLevel: ptr("primaria")}, false},
		{"invalid user_kind enum", UpdateProfileRequest{UserKind: ptr("robot")}, true},
		{"invalid preferences json", UpdateProfileRequest{Preferences: json.RawMessage("{bad")}, true},
		{"valid preferences json", UpdateProfileRequest{Preferences: json.RawMessage(`{"style":"pasos"}`)}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			err := c.req.Validate()
			if (err != nil) != c.wantErr {
				t.Fatalf("wantErr=%v, got %v", c.wantErr, err)
			}
		})
	}
}

func TestSlugify(t *testing.T) {
	cases := map[string]string{
		"Estudiante":        "estudiante",
		"Diseñador Gráfico": "dise-ador-gr-fico",
		"  Data  Science ":  "data-science",
	}
	for in, want := range cases {
		if got := slugify(in); got != want {
			t.Errorf("slugify(%q) = %q, expected %q", in, got, want)
		}
	}
}

func TestCreateProfessionValidate(t *testing.T) {
	if err := (CreateProfessionRequest{Name: ""}).Validate(); err == nil {
		t.Fatal("empty name must fail")
	}
	if err := (CreateProfessionRequest{Name: "Médico"}).Validate(); err != nil {
		t.Fatalf("valid name must not fail: %v", err)
	}
	if e := apperr.As((CreateProfessionRequest{Name: ""}).Validate()); e.Code != "VALIDATION_ERROR" {
		t.Fatalf("expected VALIDATION_ERROR, got %s", e.Code)
	}
}
