package chat

import (
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestChatRequestsValidate(t *testing.T) {
	cases := []struct {
		name    string
		req     interface{ Validate() error }
		wantErr bool
	}{
		{"message ok", SendMessageRequest{Content: "¿Qué es una integral?"}, false},
		{"message empty", SendMessageRequest{Content: "   "}, true},
		{"message too long", SendMessageRequest{Content: strings.Repeat("x", 8001)}, true},
		{"message mode ok", SendMessageRequest{Content: "x", Mode: ptr("pasos")}, false},
		{"message mode invalid", SendMessageRequest{Content: "x", Mode: ptr("audio")}, true},
		{"conversation empty ok", CreateConversationRequest{}, false},
		{"conversation kind ok", CreateConversationRequest{Kind: "group"}, false},
		{"conversation kind invalid", CreateConversationRequest{Kind: "solo"}, true},
		{"conversation title too long", CreateConversationRequest{Title: ptr(strings.Repeat("x", 201))}, true},
		{"saved toggle ok", SetSavedRequest{Saved: true}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}
