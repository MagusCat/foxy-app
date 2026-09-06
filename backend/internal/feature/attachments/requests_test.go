package attachments

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

func ptr[T any](v T) *T { return &v }

func TestUploadURLRequestValidate(t *testing.T) {
	cases := []struct {
		name    string
		req     UploadURLRequest
		wantErr bool
	}{
		{"ok", UploadURLRequest{FileName: "apuntes.pdf", MimeType: "application/pdf", SizeBytes: 1024}, false},
		{"missing name", UploadURLRequest{MimeType: "application/pdf", SizeBytes: 10}, true},
		{"missing size", UploadURLRequest{FileName: "a.pdf", MimeType: "application/pdf"}, true},
		{"over cap", UploadURLRequest{FileName: "a.pdf", MimeType: "application/pdf", SizeBytes: maxUploadBytes + 1}, true},
		{"disallowed mime", UploadURLRequest{FileName: "v.mp4", MimeType: "video/mp4", SizeBytes: 10}, true},
		{"mime case-insensitive", UploadURLRequest{FileName: "a.pdf", MimeType: "APPLICATION/PDF", SizeBytes: 10}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}

func TestRegisterRequestValidate(t *testing.T) {
	cases := []struct {
		name    string
		req     RegisterRequest
		wantErr bool
	}{
		{"ok", RegisterRequest{StoragePath: "u/x/a.pdf", FileName: "a.pdf"}, false},
		{"missing storage_path", RegisterRequest{FileName: "a.pdf"}, true},
		{"disallowed mime", RegisterRequest{StoragePath: "u/x/v.mp4", FileName: "v.mp4", MimeType: ptr("video/mp4")}, true},
		{"over cap", RegisterRequest{StoragePath: "u/x/a.pdf", FileName: "a.pdf", SizeBytes: ptr[int64](maxUploadBytes + 1)}, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if (c.req.Validate() != nil) != c.wantErr {
				t.Fatalf("wantErr=%v", c.wantErr)
			}
		})
	}
}

// TestOwnsPath covers the guard in Service.Register.
//
// The path comes from the client, and the extraction downloads it with the
// Supabase service key, which ignores RLS. Without this check a caller could
// register somebody else's object and read it back through the chat, so this is
// the whole defence: keep it.
func TestOwnsPath(t *testing.T) {
	me := uuid.New()
	someoneElse := uuid.New()

	cases := []struct {
		name string
		path string
		want bool
	}{
		{"own path", me.String() + "/" + uuid.NewString() + "/apuntes.pdf", true},
		{"another user's path", someoneElse.String() + "/x/secreto.pdf", false},
		{"no prefix at all", "apuntes.pdf", false},
		{"walks out of the prefix", me.String() + "/../" + someoneElse.String() + "/x.pdf", false},
		{"single dot segment", me.String() + "/./x.pdf", false},
		{"prefix as substring, not a segment", me.String() + "-otro/x/a.pdf", false},
		{"prefix with nothing after it", me.String() + "/", false},
		{"empty", "", false},
		{"dots inside a file name are fine", me.String() + "/x/notas..finales.pdf", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := ownsPath(me, c.path); got != c.want {
				t.Fatalf("ownsPath(%q) = %v, want %v", c.path, got, c.want)
			}
		})
	}
}

// TestCloseWaitsForTheExtractionsInFlight covers what the old `go extract(...)`
// did not: a deploy used to abandon them mid-run, leaving the attachment stuck
// on 'pending', which nothing re-processes.
func TestCloseWaitsForTheExtractionsInFlight(t *testing.T) {
	var done atomic.Int32
	started := make(chan struct{})

	svc := &Service{jobs: make(chan extractJob, extractQueueSize)}
	svc.wg.Add(1)
	go func() {
		defer svc.wg.Done()
		for range svc.jobs {
			close(started)
			time.Sleep(50 * time.Millisecond) // the work still running when Close is called
			done.Add(1)
		}
	}()

	svc.jobs <- extractJob{id: uuid.New()}
	<-started
	svc.Close()

	if got := done.Load(); got != 1 {
		t.Fatalf("Close returned with %d finished extractions, want 1", got)
	}
}
