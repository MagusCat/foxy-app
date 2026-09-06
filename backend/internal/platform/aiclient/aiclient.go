// Package aiclient talks to the ai-service (Python). It ships a stub mode: if the
// configured URL is "stub", it responds with fixed text and no network, so the
// backend can move forward while the ai-service is built in parallel.
package aiclient

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
)

type Client struct {
	baseURL string
	token   string // shared secret; empty means the ai-service isn't asking for one
	http    *http.Client
	stub    bool
}

func New(baseURL, token string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		http:    &http.Client{Timeout: 120 * time.Second, Transport: newTransport()},
		stub:    baseURL == "stub" || baseURL == "",
	}
}

// newTransport tunes the connection pool for a service we call constantly. The
// default Transport keeps only 2 idle connections per host, so past 2 concurrent
// calls every request paid a fresh TCP+TLS handshake and burned ephemeral ports.
func newTransport() *http.Transport {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.MaxIdleConns = 200
	t.MaxIdleConnsPerHost = 100
	t.IdleConnTimeout = 90 * time.Second
	return t
}

// post builds every call to the ai-service: JSON body, a token emitted for this
// request with the scope of the endpoint, and the request-id, so one request can
// be followed across both services.
func (c *Client) post(ctx context.Context, path, scope string, body []byte) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, apperr.ErrAIUnavailable.Wrap(err)
	}
	req.Header.Set("Content-Type", "application/json")
	// Sin secreto no se firma nada: es el modo ALLOW_INSECURE de desarrollo, y
	// el ai-service tiene que estar arrancado igual para aceptarlo. En
	// producción config.Load() se niega a arrancar sin él.
	if c.token != "" {
		token, err := c.mint(ctx, scope)
		if err != nil {
			return nil, apperr.Internal(err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if id := reqctx.RequestID(ctx); id != "" {
		req.Header.Set("X-Request-Id", id)
	}
	return req, nil
}

// Retrieval scopes the document search the ai-service runs. The ids travel
// already authorized; see attachments.Repository.VisibleIDs.
type Retrieval struct {
	AttachmentIDs []uuid.UUID `json:"attachment_ids,omitempty"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatContext is who is asking: the profile the backend owns and the notebook's
// objectives. It travels as data, not as prose — the persona and the wording of
// the system prompt belong to the ai-service (ai-service/app/prompts.toml).
type ChatContext struct {
	UserKind           string   `json:"user_kind,omitempty"` // student / teacher / professional
	AcademicLevel      *string  `json:"academic_level,omitempty"`
	MainGoal           *string  `json:"main_goal,omitempty"`
	CustomInstructions *string  `json:"custom_instructions,omitempty"`
	Mode               *string  `json:"mode,omitempty"` // respuesta / pasos / quiz
	Objectives         []string `json:"objectives,omitempty"`
}

type ChatRequest struct {
	Context   ChatContext `json:"context"`
	Messages  []Message   `json:"messages"`
	Retrieval Retrieval   `json:"retrieval"`
}

type GenerateRequest struct {
	Type      string    `json:"type"`
	Prompt    string    `json:"prompt"`
	Retrieval Retrieval `json:"retrieval"`
}

type GenerateResponse struct {
	Content json.RawMessage `json:"content"`
}

// ExtractRequest names what /v1/extract takes. The id lets the ai-service index
// the fragments, and the file name is stored with them so an answer can cite its
// source — the storage path only carries a sanitized copy of that name.
type ExtractRequest struct {
	StoragePath  string    `json:"storage_path"`
	AttachmentID uuid.UUID `json:"attachment_id"`
	FileName     string    `json:"file_name"`
}

type ExtractResponse struct {
	Text string `json:"text"`
}

// StreamChat forwards each token to onToken and returns the full text at the end.
func (c *Client) StreamChat(ctx context.Context, req ChatRequest, onToken func(string)) (string, error) {
	if c.stub {
		return c.stubStream(ctx, onToken)
	}
	body, _ := json.Marshal(req)
	httpReq, err := c.post(ctx, "/v1/chat", scopeChat, body)
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Accept", "text/event-stream")
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", apperr.ErrAIUnavailable.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", apperr.ErrAIUnavailable.Wrap(fmt.Errorf("ai-service status %d", resp.StatusCode))
	}

	var full strings.Builder
	sc := bufio.NewScanner(resp.Body)
	sc.Buffer(make([]byte, 0, 64*1024), 1<<20)
	for sc.Scan() {
		line := sc.Text()
		data, ok := strings.CutPrefix(line, "data: ")
		if !ok {
			continue
		}
		var tok struct {
			Content string `json:"content"`
			Done    bool   `json:"done"`
		}
		if err := json.Unmarshal([]byte(data), &tok); err != nil {
			continue
		}
		if tok.Done {
			break
		}
		if tok.Content != "" {
			full.WriteString(tok.Content)
			onToken(tok.Content)
		}
	}
	if err := sc.Err(); err != nil {
		return full.String(), apperr.ErrAIUnavailable.Wrap(err)
	}
	return full.String(), nil
}

// Generate requests structured material (plan, exam, flashcards) and returns it as JSON.
func (c *Client) Generate(ctx context.Context, req GenerateRequest) (json.RawMessage, error) {
	if c.stub {
		return stubGenerate(req.Type), nil
	}
	body, _ := json.Marshal(req)

	// generate is idempotent: retry once on a transient failure before giving
	// up with a 502.
	var lastErr error
	for attempt := 0; attempt < 2; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, apperr.ErrAIUnavailable.Wrap(ctx.Err())
			case <-time.After(300 * time.Millisecond):
			}
		}
		content, err := c.generateOnce(ctx, body)
		if err == nil {
			return content, nil
		}
		lastErr = err
	}
	return nil, lastErr
}

func (c *Client) generateOnce(ctx context.Context, body []byte) (json.RawMessage, error) {
	httpReq, err := c.post(ctx, "/v1/generate", scopeGenerate, body)
	if err != nil {
		return nil, err
	}
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, apperr.ErrAIUnavailable.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, apperr.ErrAIUnavailable.Wrap(fmt.Errorf("ai-service status %d", resp.StatusCode))
	}
	var out GenerateResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, apperr.ErrAIUnavailable.Wrap(err)
	}
	return out.Content, nil
}

// Extract asks the ai-service for the plain text of a file already uploaded to
// Storage. In stub mode it returns empty.
func (c *Client) Extract(ctx context.Context, req ExtractRequest) (string, error) {
	if c.stub {
		return "", nil
	}
	body, _ := json.Marshal(req)
	httpReq, err := c.post(ctx, "/v1/extract", scopeExtract, body)
	if err != nil {
		return "", err
	}
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", apperr.ErrAIUnavailable.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", apperr.ErrAIUnavailable.Wrap(fmt.Errorf("ai-service status %d", resp.StatusCode))
	}
	var out ExtractResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", apperr.ErrAIUnavailable.Wrap(err)
	}
	return out.Text, nil
}

// --- stub ---

func (c *Client) stubStream(ctx context.Context, onToken func(string)) (string, error) {
	const canned = "Esta es una respuesta de ejemplo de Foxy. El servicio de IA aún no está conectado, así que este texto es fijo para probar el streaming de extremo a extremo."
	var full strings.Builder
	for _, word := range strings.Fields(canned) {
		select {
		case <-ctx.Done():
			return full.String(), ctx.Err()
		default:
		}
		tok := word + " "
		full.WriteString(tok)
		onToken(tok)
		time.Sleep(25 * time.Millisecond) // simulate the generation pace
	}
	return strings.TrimSpace(full.String()), nil
}

func stubGenerate(materialType string) json.RawMessage {
	// Material types mirror the materials.type CHECK. Literals (not the materials
	// constants) to avoid a cycle.
	switch materialType {
	case "flashcards":
		return json.RawMessage(`{"cards":[{"front":"¿Qué es una derivada?","back":"La tasa de cambio instantánea de una función."}]}`)
	case "exam":
		return json.RawMessage(`{"questions":[{"type":"multiple_choice","q":"2+2","options":["3","4","5"],"answer":1},{"type":"open","q":"Define derivada.","answer":"La tasa de cambio instantánea de una función."},{"type":"true_false","q":"La integral es la operación inversa de la derivada.","answer":true}]}`)
	case "summary", "notes", "lesson_text":
		return json.RawMessage(`{"text":"Resumen de ejemplo (stub). El servicio de IA aún no está conectado."}`)
	case "assignment", "exercise":
		return json.RawMessage(`{"tasks":["Ejercicio de ejemplo (stub)"]}`)
	case "true_false":
		return json.RawMessage(`{"questions":[{"q":"La integral es la operación inversa de la derivada.","answer":true}]}`)
	case "weak_areas":
		return json.RawMessage(`{"areas":[{"topic":"Derivadas","hint":"Repasa la regla de la cadena."}]}`)
	default:
		return json.RawMessage(`{"note":"contenido de ejemplo (stub)"}`)
	}
}
