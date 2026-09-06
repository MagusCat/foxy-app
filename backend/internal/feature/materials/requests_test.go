package materials

import (
	"encoding/json"
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestGenerateRequestValidate(t *testing.T) {
	cases := []struct {
		name    string
		req     GenerateRequest
		wantErr bool
	}{
		{"ok", GenerateRequest{Type: TypeExam, Prompt: "sobre derivadas"}, false},
		{"unsupported type", GenerateRequest{Type: "podcast", Prompt: "x"}, true},
		{"empty type", GenerateRequest{Type: "", Prompt: "x"}, true},
		{"empty prompt", GenerateRequest{Type: TypeSummary, Prompt: "  "}, true},
		{"prompt too long", GenerateRequest{Type: TypeNotes, Prompt: strings.Repeat("x", maxPromptLen+1)}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}

func TestValidTypesAreAllProductTypes(t *testing.T) {
	// Guards against silently accepting a type the DB CHECK would reject.
	want := map[string]bool{TypeSummary: true, TypeFlashcards: true, TypeExam: true, TypeAssignment: true, TypeNotes: true}
	if len(validTypes) != len(want) {
		t.Fatalf("validTypes drifted: %v", validTypes)
	}
	for k := range want {
		if !validTypes[k] {
			t.Errorf("validTypes missing %q", k)
		}
	}
}

func TestSubmitAttemptValidate(t *testing.T) {
	cases := []struct {
		name    string
		req     SubmitAttemptRequest
		wantErr bool
	}{
		{"ok", SubmitAttemptRequest{Answers: json.RawMessage(`[{"q":1,"a":2}]`)}, false},
		{"empty answers", SubmitAttemptRequest{Answers: nil}, true},
		{"invalid json", SubmitAttemptRequest{Answers: json.RawMessage(`{`)}, true},
		{"score out of range", SubmitAttemptRequest{Answers: json.RawMessage(`[]`), Score: ptr(101.0)}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}
