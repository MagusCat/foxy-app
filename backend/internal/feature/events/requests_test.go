package events

import (
	"strings"
	"testing"
	"time"
)

func ptr[T any](v T) *T { return &v }

func TestCreateEventRequestValidate(t *testing.T) {
	now := time.Now()
	cases := []struct {
		name    string
		req     CreateEventRequest
		wantErr bool
	}{
		{"ok", CreateEventRequest{Title: "Examen", Kind: "exam", StartsAt: now}, false},
		{"empty title", CreateEventRequest{Title: " ", Kind: "exam", StartsAt: now}, true},
		{"title too long", CreateEventRequest{Title: strings.Repeat("x", 201), Kind: "exam", StartsAt: now}, true},
		{"invalid kind", CreateEventRequest{Title: "X", Kind: "party", StartsAt: now}, true},
		{"missing starts_at", CreateEventRequest{Title: "X", Kind: "exam"}, true},
		{"ends before starts", CreateEventRequest{Title: "X", Kind: "class", StartsAt: now, EndsAt: ptr(now.Add(-time.Hour))}, true},
		{"ends after starts", CreateEventRequest{Title: "X", Kind: "class", StartsAt: now, EndsAt: ptr(now.Add(time.Hour))}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}

func TestUpdateEventRequestValidate(t *testing.T) {
	now := time.Now()
	cases := []struct {
		name    string
		req     UpdateEventRequest
		wantErr bool
	}{
		{"empty is ok", UpdateEventRequest{}, false},
		{"invalid kind", UpdateEventRequest{Kind: ptr("party")}, true},
		{"blank title", UpdateEventRequest{Title: ptr("  ")}, true},
		{"ends before starts", UpdateEventRequest{StartsAt: ptr(now), EndsAt: ptr(now.Add(-time.Hour))}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}
