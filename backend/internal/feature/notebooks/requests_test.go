package notebooks

import (
	"strings"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestNotebookRequestsValidate(t *testing.T) {
	long := strings.Repeat("x", 101)
	cases := []struct {
		name    string
		req     interface{ Validate() error }
		wantErr bool
	}{
		{"create ok", CreateNotebookRequest{Name: "Cálculo"}, false},
		{"create empty name", CreateNotebookRequest{Name: "  "}, true},
		{"create name too long", CreateNotebookRequest{Name: long}, true},
		{"update empty is ok", UpdateNotebookRequest{}, false},
		{"update blank name", UpdateNotebookRequest{Name: ptr("  ")}, true},
		{"join ok", JoinNotebookRequest{Code: "AB12CD"}, false},
		{"join empty", JoinNotebookRequest{Code: ""}, true},
		{"objective ok", CreateObjectiveRequest{Title: "Derivadas"}, false},
		{"objective empty title", CreateObjectiveRequest{Title: ""}, true},
		{"progress ok", SetProgressRequest{ProgressPct: 60}, false},
		{"progress below 0", SetProgressRequest{ProgressPct: -1}, true},
		{"progress above 100", SetProgressRequest{ProgressPct: 101}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}
