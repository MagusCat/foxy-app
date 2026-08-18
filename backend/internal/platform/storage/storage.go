// Package storage issues signed upload URLs for Supabase Storage. The binary
// never passes through the backend: the mobile client uploads straight to the
// signed URL.
package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

type Client struct {
	baseURL    string
	serviceKey string
	bucket     string
	http       *http.Client
}

func New(supabaseURL, serviceKey, bucket string) *Client {
	return &Client{
		baseURL:    strings.TrimRight(supabaseURL, "/") + "/storage/v1",
		serviceKey: serviceKey,
		bucket:     bucket,
		http:       &http.Client{Timeout: 15 * time.Second},
	}
}

// NewPath builds a unique, ordered path: userID/uuid/file. The uuid avoids
// collisions even when two files share the same name.
func (c *Client) NewPath(userID uuid.UUID, fileName string) string {
	return fmt.Sprintf("%s/%s/%s", userID, uuid.NewString(), sanitize(fileName))
}

// SignUploadURL returns the URL the mobile client PUTs the binary to.
func (c *Client) SignUploadURL(ctx context.Context, path string) (string, error) {
	endpoint := c.baseURL + "/object/upload/sign/" + c.bucket + "/" + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader([]byte(`{}`)))
	if err != nil {
		return "", apperr.Internal(err)
	}
	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("apikey", c.serviceKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return "", apperr.Internal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", apperr.Internal(fmt.Errorf("supabase storage sign status %d", resp.StatusCode))
	}
	var out struct {
		URL string `json:"url"` // relative path with ?token=...
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", apperr.Internal(err)
	}
	return c.baseURL + out.URL, nil
}

// sanitize keeps only characters that are safe for an object path.
func sanitize(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "file"
	}
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			return r
		case r == '.' || r == '-' || r == '_':
			return r
		default:
			return '-'
		}
	}, name)
}
