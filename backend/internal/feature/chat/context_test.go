package chat

import (
	"strings"
	"testing"
)

func TestBuildSystemPromptNilContext(t *testing.T) {
	if got := buildSystemPrompt("BASE", nil); got != "BASE" {
		t.Fatalf("nil context should return the base prompt, got %q", got)
	}
}

func TestBuildSystemPromptIncludesFields(t *testing.T) {
	pc := &PromptContext{
		AcademicLevel: ptr("universidad"),
		MainGoal:      ptr("aprobar cálculo"),
		Objectives:    []string{"Derivadas", "Integrales"},
	}
	got := buildSystemPrompt("BASE", pc)
	for _, want := range []string{"BASE", "universidad", "aprobar cálculo", "Derivadas", "Integrales"} {
		if !strings.Contains(got, want) {
			t.Errorf("prompt missing %q: %s", want, got)
		}
	}
}

func TestJoinDocumentsRespectsBudget(t *testing.T) {
	big := strings.Repeat("a", docBudget*2)
	out := joinDocuments([]string{big})
	if len(out) > docBudget+3 { // +3 for the trailing "…" (a 3-byte rune)
		t.Fatalf("document text exceeded docBudget: got %d bytes", len(out))
	}
	if !strings.HasSuffix(out, "…") {
		t.Error("truncated document should end with an ellipsis")
	}
}

func TestComposeBaseSelectsByUserKind(t *testing.T) {
	if got := composeBase("", "teacher"); !strings.Contains(got, "docente") {
		t.Errorf("teacher persona missing: %s", got)
	}
	// An env override replaces the base but keeps the per-kind addition.
	over := composeBase("PERSONA-X", "student")
	if !strings.HasPrefix(over, "PERSONA-X") {
		t.Error("override should replace the base")
	}
	if !strings.Contains(over, "estudiante") {
		t.Error("override should keep the per-kind addition")
	}
	// An unknown kind falls back to the base alone.
	if composeBase("", "robot") != basePrompt {
		t.Error("unknown kind should be base only")
	}
}

func TestJoinDocumentsSkipsBlank(t *testing.T) {
	if got := joinDocuments([]string{"  ", ""}); got != "" {
		t.Fatalf("blank documents should produce empty output, got %q", got)
	}
}
