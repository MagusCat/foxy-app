package chat

import (
	"embed"
	"fmt"
	"strings"
)

// The persona is split by user_kind: a common base plus a per-kind addition,
// each in its own file under prompts/. To add or edit Foxy's tone, edit those
// files — no code change. FOXY_SYSTEM_PROMPT (env) overrides the base at runtime.
//
//go:embed prompts/*.md
var promptFS embed.FS

var (
	basePrompt = mustPrompt("prompts/base.md")
	// kindPrompt keys mirror the user_kind enum in the DB.
	kindPrompt = map[string]string{
		"student":      mustPrompt("prompts/student.md"),
		"teacher":      mustPrompt("prompts/teacher.md"),
		"professional": mustPrompt("prompts/professional.md"),
	}
)

func mustPrompt(name string) string {
	b, err := promptFS.ReadFile(name)
	if err != nil {
		panic(fmt.Sprintf("chat: missing embedded prompt %q: %v", name, err))
	}
	return strings.TrimSpace(string(b))
}

// composeBase builds the persona: the env override or the base file, plus the
// user_kind-specific addition when the kind is known.
func composeBase(override, userKind string) string {
	base := strings.TrimSpace(override)
	if base == "" {
		base = basePrompt
	}
	if k := kindPrompt[userKind]; k != "" {
		return base + "\n\n" + k
	}
	return base
}
