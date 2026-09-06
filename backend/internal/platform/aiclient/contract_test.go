package aiclient

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

// Las constantes que sostienen la autenticación entre servicios están escritas
// dos veces y en dos lenguajes: aquí y en ai-service/app/platform/security.py.
// Cada suite pasa aunque dejen de coincidir, y el síntoma no es una degradación
// sino que el ai-service rechaza absolutamente todo. El test e2e lo destapa, pero
// exige un servicio levantado; estos no necesitan ninguno.
const securityPy = "../../../../ai-service/app/platform/security.py"

func TestTheWireConstantsMatchTheAIServiceThatChecksThem(t *testing.T) {
	src, err := os.ReadFile(securityPy)
	if err != nil {
		t.Skipf("sin el ai-service al lado del backend no hay nada que comparar: %v", err)
	}
	for pyName, minted := range map[string]string{
		"SCOPE_CHAT":     scopeChat,
		"SCOPE_GENERATE": scopeGenerate,
		"SCOPE_EXTRACT":  scopeExtract,
		"ISSUER":         tokenIssuer,
		"AUDIENCE":       tokenAudience,
		"ALGORITHM":      jwt.SigningMethodHS256.Alg(),
	} {
		m := regexp.MustCompile(`(?m)^` + pyName + ` = "([^"]*)"`).FindSubmatch(src)
		if m == nil {
			t.Errorf("%s ya no existe en security.py: el ai-service dejó de comprobarlo", pyName)
			continue
		}
		if expected := string(m[1]); expected != minted {
			t.Errorf("%s: aquí se emite %q y allí se espera %q — la autenticación entre servicios está rota",
				pyName, minted, expected)
		}
	}
}

func TestTheThreeScopesAreDistinct(t *testing.T) {
	// Un copia-pega que dejara dos alcances iguales no rompería nada visible: el
	// ai-service seguiría respondiendo. Lo que se pierde en silencio es la
	// separación, y con ella lo único que impide que un token de chat filtrado
	// llegue a /v1/extract, que lee todo el bucket.
	seen := map[string]bool{}
	for _, scope := range []string{scopeChat, scopeGenerate, scopeExtract} {
		if scope == "" {
			t.Fatal("un alcance vacío no separa nada")
		}
		if seen[scope] {
			t.Fatalf("el alcance %q está repetido: dos endpoints comparten autorización", scope)
		}
		seen[scope] = true
	}
}

// TestEachEndpointMintsItsOwnScope es la propiedad de verdad: no que las cadenas
// existan, sino que cada llamada viaje con la suya. Emitir el alcance equivocado
// —o el mismo para todo— devuelve el token a ser una llave maestra.
func TestEachEndpointMintsItsOwnScope(t *testing.T) {
	const key = "clave-compartida"
	scopes := make(chan string, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims := jwt.MapClaims{}
		_, err := jwt.NewParser(jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()})).
			ParseWithClaims(r.Header.Get("Authorization")[len("Bearer "):], claims,
				func(*jwt.Token) (any, error) { return []byte(key), nil })
		if err != nil {
			t.Errorf("%s viajó con un token que no se puede verificar: %v", r.URL.Path, err)
		}
		scopes <- claims["scope"].(string)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"content":{},"text":"","chunks":0}`))
	}))
	defer srv.Close()

	c := New(srv.URL, key)
	for _, tc := range []struct {
		path, want string
		call       func() error
	}{
		{"/v1/chat", scopeChat, func() error {
			_, err := c.StreamChat(userCtx(), ChatRequest{}, func(string) {})
			return err
		}},
		{"/v1/generate", scopeGenerate, func() error {
			_, err := c.Generate(userCtx(), GenerateRequest{Type: "summary"})
			return err
		}},
		{"/v1/extract", scopeExtract, func() error {
			_, err := c.Extract(userCtx(), ExtractRequest{StoragePath: "u/1/a.pdf"})
			return err
		}},
	} {
		if err := tc.call(); err != nil {
			t.Fatalf("%s: %v", tc.path, err)
		}
		if got := <-scopes; got != tc.want {
			t.Errorf("%s viajó con el alcance %q en vez de %q", tc.path, got, tc.want)
		}
	}
}

// TestTheMaterialTypesMatchTheDatabase ata el stub a lo que la columna acepta. El
// stub usa literales a propósito (importar materials sería un ciclo), así que sin
// esto un tipo nuevo se queda sin respuesta de desarrollo y nadie se entera.
func TestTheMaterialTypesMatchTheDatabase(t *testing.T) {
	for _, materialType := range materialTypesInDB(t) {
		var content map[string]any
		if err := json.Unmarshal(stubGenerate(materialType), &content); err != nil {
			t.Errorf("el stub de %q no devuelve JSON: %v", materialType, err)
			continue
		}
		if _, generic := content["note"]; generic {
			t.Errorf("%q está en el CHECK de la base pero stubGenerate cae en el default", materialType)
		}
	}
}

// materialTypesInDB lee el CHECK que realmente se aplica sobre materials.type.
// La lista está escrita en cuatro sitios (aquí, materials/model.go, prompts.toml
// y la migración); la única con autoridad es la que corre contra Postgres.
func materialTypesInDB(t *testing.T) []string {
	t.Helper()
	const migration = "../../../../supabase/migrations/20260904140000_schema_v3.sql"
	src, err := os.ReadFile(migration)
	if err != nil {
		t.Skipf("sin las migraciones al lado no hay contra qué comparar: %v", err)
	}
	m := regexp.MustCompile(`CHECK \(type IN \(([^)]*)\)\)`).FindSubmatch(src)
	if m == nil {
		t.Fatalf("no se encontró el CHECK de materials.type en %s", migration)
	}
	var types []string
	for _, q := range regexp.MustCompile(`'([^']+)'`).FindAllStringSubmatch(string(m[1]), -1) {
		types = append(types, q[1])
	}
	return types
}
