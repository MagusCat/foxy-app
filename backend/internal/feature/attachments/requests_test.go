package attachments

import "testing"

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
