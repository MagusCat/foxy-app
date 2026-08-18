package topics

import (
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestTopicRequestsValidate(t *testing.T) {
	long := strings.Repeat("x", 121)
	cases := []struct {
		name    string
		req     interface{ Validate() error }
		wantErr bool
	}{
		{"create ok", CreateTopicRequest{Name: "Álgebra"}, false},
		{"create empty", CreateTopicRequest{Name: "  "}, true},
		{"create too long", CreateTopicRequest{Name: long}, true},
		{"update empty ok", UpdateTopicRequest{}, false},
		{"update blank name", UpdateTopicRequest{Name: ptr("  ")}, true},
		{"update too long", UpdateTopicRequest{Name: ptr(long)}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}
