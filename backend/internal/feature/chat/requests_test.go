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
		{"conversation empty ok", CreateConversationRequest{}, false},
		{"conversation title too long", CreateConversationRequest{Title: ptr(strings.Repeat("x", 201))}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}
