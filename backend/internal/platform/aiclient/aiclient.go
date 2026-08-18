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
)

type Client struct {
	baseURL string
	http    *http.Client
	stub    bool
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 120 * time.Second},
		stub:    baseURL == "stub" || baseURL == "",
	}
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	System   string    `json:"system"`
	Messages []Message `json:"messages"`
}

// StreamChat forwards each token to onToken and returns the full text at the end.
func (c *Client) StreamChat(ctx context.Context, req ChatRequest, onToken func(string)) (string, error) {
	if c.stub {
		return c.stubStream(ctx, onToken)
	}
	body, _ := json.Marshal(req)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/chat", bytes.NewReader(body))
	if err != nil {
		return "", apperr.ErrAIUnavailable.Wrap(err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
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

type GenerateRequest struct {
	Type    string `json:"type"`
	Context string `json:"context"`
	Prompt  string `json:"prompt"`
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
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/generate", bytes.NewReader(body))
	if err != nil {
		return nil, apperr.ErrAIUnavailable.Wrap(err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, apperr.ErrAIUnavailable.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, apperr.ErrAIUnavailable.Wrap(fmt.Errorf("ai-service status %d", resp.StatusCode))
	}
	var out struct {
		Content json.RawMessage `json:"content"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, apperr.ErrAIUnavailable.Wrap(err)
	}
	return out.Content, nil
}

// Extract asks the ai-service for the plain text of a file already uploaded to
// Storage. In stub mode it returns empty (there's no extractor yet).
func (c *Client) Extract(ctx context.Context, storagePath string) (string, error) {
	if c.stub {
		return "", nil
	}
	body, _ := json.Marshal(map[string]string{"storage_path": storagePath})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/extract", bytes.NewReader(body))
	if err != nil {
		return "", apperr.ErrAIUnavailable.Wrap(err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(httpReq)
	if err != nil {
		return "", apperr.ErrAIUnavailable.Wrap(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", apperr.ErrAIUnavailable.Wrap(fmt.Errorf("ai-service status %d", resp.StatusCode))
	}
	var out struct {
		Text string `json:"text"`
	}
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
	// Material types mirror the materials.type CHECK: summary, flashcards, exam,
	// assignment, notes. Literals (not the materials constants) to avoid a cycle.
	switch materialType {
	case "flashcards":
		return json.RawMessage(`{"cards":[{"front":"¿Qué es una derivada?","back":"La tasa de cambio instantánea de una función."}]}`)
	case "exam":
		return json.RawMessage(`{"questions":[{"q":"2+2","options":["3","4","5"],"answer":1}]}`)
	case "summary", "notes":
		return json.RawMessage(`{"text":"Resumen de ejemplo (stub). El servicio de IA aún no está conectado."}`)
	case "assignment":
		return json.RawMessage(`{"tasks":["Ejercicio de ejemplo (stub)"]}`)
	default:
		return json.RawMessage(`{"note":"contenido de ejemplo (stub)"}`)
	}
}
