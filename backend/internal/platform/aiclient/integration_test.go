package aiclient

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
)

// Los dos servicios se autentican con constantes duplicadas en dos lenguajes
// (aiclient/token.go y ai-service/app/platform/security.py). Los tests de cada
// lado pasan aunque esas constantes dejen de coincidir; solo hablar de verdad lo
// destapa. Este test lo hace: firma con el emisor real y llama al proceso real.
//
// Se salta si no hay servicio levantado, como los de repositorio sin DATABASE_URL:
//
//	AI_SERVICE_E2E_URL=http://127.0.0.1:8099 \
//	AI_SERVICE_E2E_TOKEN=<la misma clave del servicio> go test ./internal/platform/aiclient/
func e2e(t *testing.T) *Client {
	t.Helper()
	url, token := os.Getenv("AI_SERVICE_E2E_URL"), os.Getenv("AI_SERVICE_E2E_TOKEN")
	if url == "" || token == "" {
		t.Skip("no AI_SERVICE_E2E_URL/TOKEN: skipping cross-service test")
	}
	return New(url, token)
}

// userCtx imita lo que deja el middleware de auth: el usuario y el request-id que
// mint() mete en el token.
func userCtx() context.Context {
	return reqctx.WithRequestID(
		reqctx.WithUser(context.Background(), reqctx.User{ID: uuid.New()}), uuid.NewString())
}

func TestTheAIServiceAcceptsATokenThisClientMints(t *testing.T) {
	c := e2e(t)
	var got strings.Builder
	full, err := c.StreamChat(userCtx(), ChatRequest{
		Messages: []Message{{Role: "user", Content: "hola"}},
	}, func(tok string) { got.WriteString(tok) })
	if err != nil {
		t.Fatalf("the ai-service refused a token minted here: %v", err)
	}
	if full == "" || got.String() != full {
		t.Fatalf("streamed %q but assembled %q", full, got.String())
	}
}

func TestGenerateCrossesTheBoundaryToo(t *testing.T) {
	c := e2e(t)
	content, err := c.Generate(userCtx(), GenerateRequest{Type: "summary", Prompt: "resume esto"})
	if err != nil {
		t.Fatalf("generate refused: %v", err)
	}
	var out map[string]any
	if err := json.Unmarshal(content, &out); err != nil {
		t.Fatalf("the answer is not JSON: %v", err)
	}
	if out["text"] == nil {
		t.Fatalf("a summary must carry 'text', got %v", out)
	}
}

// TestAScopeIsNotEnoughForAnotherEndpoint es el que justifica el alcance: sin él
// un token filtrado de un chat abriría /v1/extract, que lee todo el bucket con la
// service key. Se salta el cliente y se manda el token a mano porque post() nunca
// emitiría esta combinación.
func TestAScopeIsNotEnoughForAnotherEndpoint(t *testing.T) {
	c := e2e(t)
	chatToken, err := c.mint(userCtx(), scopeChat)
	if err != nil {
		t.Fatal(err)
	}
	body := `{"storage_path":"u/u/a.txt","attachment_id":"` + uuid.NewString() + `"}`
	req, _ := http.NewRequest(http.MethodPost, c.baseURL+"/v1/extract", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+chatToken)

	resp, err := c.http.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("a chat token opened /v1/extract: status %d", resp.StatusCode)
	}
}

func TestWithoutATokenNothingGoesThrough(t *testing.T) {
	c := e2e(t)
	for _, path := range []string{"/v1/chat", "/v1/generate", "/v1/extract"} {
		req, _ := http.NewRequest(http.MethodPost, c.baseURL+path, strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		resp, err := c.http.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s answered %d without a token, want 401", path, resp.StatusCode)
		}
	}
}
