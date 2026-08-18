package chat

import (
	"fmt"
	"strings"
)

// PromptContext is what shapes each AI reply to the student: their profile, the
// zone's objectives, and the text of the files they uploaded.
type PromptContext struct {
	UserKind           string // selects the per-kind persona (student/teacher/professional)
	AcademicLevel      *string
	MainGoal           *string
	StudyTimeAvgMin    *int
	CustomInstructions *string
	Objectives         []string
	Documents          []string
}

// docBudget caps how much document text enters the prompt, to bound tokens (and
// cost). The rest is truncated.
const docBudget = 6000

// buildSystemPrompt assembles the system prompt: the persona (base + per-kind,
// with override) plus the user's context. Pure function, testable without a DB.
func buildSystemPrompt(override string, pc *PromptContext) string {
	var b strings.Builder
	userKind := ""
	if pc != nil {
		userKind = pc.UserKind
	}
	b.WriteString(composeBase(override, userKind))
	if pc == nil {
		return b.String()
	}

	if pc.AcademicLevel != nil && *pc.AcademicLevel != "" {
		fmt.Fprintf(&b, " Ajusta el nivel al de un estudiante de %s.", *pc.AcademicLevel)
	}
	if pc.MainGoal != nil && *pc.MainGoal != "" {
		fmt.Fprintf(&b, " Su objetivo principal es: %s.", *pc.MainGoal)
	}
	if pc.StudyTimeAvgMin != nil && *pc.StudyTimeAvgMin > 0 {
		fmt.Fprintf(&b, " Suele estudiar en sesiones de ~%d minutos; dimensiona tus sugerencias a eso.", *pc.StudyTimeAvgMin)
	}
	if len(pc.Objectives) > 0 {
		fmt.Fprintf(&b, " Objetivos de la zona de estudio: %s.", strings.Join(pc.Objectives, "; "))
	}
	if pc.CustomInstructions != nil && *pc.CustomInstructions != "" {
		// Presented as a preference, never as an order that can override the system rules.
		fmt.Fprintf(&b, " Preferencias del usuario (respétalas si no contradicen lo anterior): %s", *pc.CustomInstructions)
	}
	if docs := joinDocuments(pc.Documents); docs != "" {
		fmt.Fprintf(&b, "\n\nMaterial de referencia que subió el usuario:\n%s", docs)
	}
	return b.String()
}

func joinDocuments(docs []string) string {
	var b strings.Builder
	for _, d := range docs {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		remaining := docBudget - b.Len()
		if remaining <= 0 {
			break
		}
		if len(d) > remaining {
			d = d[:remaining] + "…"
		}
		if b.Len() > 0 {
			b.WriteString("\n---\n")
		}
		b.WriteString(d)
	}
	return b.String()
}
