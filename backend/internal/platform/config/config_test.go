package config

import (
	"strings"
	"testing"
	"time"
)

// valid deja el entorno en el mínimo que arranca. Cada test ensucia una variable
// encima para comprobar que el arranque la rechaza.
func valid(t *testing.T) {
	t.Helper()
	for k, v := range map[string]string{
		"DATABASE_URL":        "postgresql://user:pass@localhost:5432/postgres",
		"SUPABASE_URL":        "https://ref.supabase.co",
		"SUPABASE_SECRET_KEY": "sb_secret",
		"AI_SERVICE_TOKEN":    "shared",
	} {
		t.Setenv(k, v)
	}
	// Las que Load lee y podrían venir de la máquina que corre los tests.
	for _, k := range []string{
		"HOST", "PORT", "AI_SERVICE_URL", "ALLOW_INSECURE", "LOG_LEVEL", "STORAGE_BUCKET",
		"RATE_LIMIT_PER_MINUTE", "RATE_LIMIT_BURST", "MAX_CONCURRENT_STREAMS",
		"REQUEST_TIMEOUT", "SHUTDOWN_TIMEOUT", "DB_MAX_CONNS", "ALLOWED_ORIGINS",
		"SUPABASE_JWKS_URL", "SUPABASE_JWT_ISSUER", "SUPABASE_SERVICE_ROLE_KEY",
	} {
		t.Setenv(k, "")
	}
}

func TestDefaults(t *testing.T) {
	valid(t)
	c, err := Load()
	if err != nil {
		t.Fatalf("el mínimo debería arrancar: %v", err)
	}
	if c.Port != "8080" || c.LogLevel != "info" || c.RequestTimeout != 30*time.Second {
		t.Errorf("defaults perdidos: %+v", c)
	}
	if c.SupabaseJWTIssuer != "https://ref.supabase.co/auth/v1" {
		t.Errorf("issuer derivado mal: %q", c.SupabaseJWTIssuer)
	}
}

// El caso que motivó todo esto: antes, cualquiera de estos valores se descartaba
// en silencio y el proceso arrancaba con el default. ALLOW_INSECURE=yes es el
// peligroso — el operador cree haber abierto el modo desarrollo, o al revés.
func TestAnInvalidValueRefusesToBoot(t *testing.T) {
	for _, tc := range []struct{ key, val string }{
		{"ALLOW_INSECURE", "yes"},
		{"LOG_LEVEL", "verbose"},
		{"RATE_LIMIT_PER_MINUTE", "abc"},
		{"RATE_LIMIT_PER_MINUTE", "0"},
		{"MAX_CONCURRENT_STREAMS", "-1"},
		{"REQUEST_TIMEOUT", "30"}, // sin unidad
		{"SHUTDOWN_TIMEOUT", "0s"},
		{"PORT", "ochomil"},
		{"PORT", "70000"},
		{"DATABASE_URL", "mysql://localhost/foxy"},
		{"SUPABASE_URL", "ref.supabase.co"}, // sin esquema
		{"AI_SERVICE_URL", "localhost:8000"},
		{"RATE_LIMIT_BURST", "999"},
	} {
		t.Run(tc.key+"="+tc.val, func(t *testing.T) {
			valid(t)
			t.Setenv(tc.key, tc.val)
			_, err := Load()
			if err == nil {
				t.Fatalf("%s=%q debería abortar el arranque", tc.key, tc.val)
			}
			if !strings.Contains(err.Error(), tc.key) {
				t.Errorf("el error no nombra la variable: %v", err)
			}
		})
	}
}

// Un secreto nunca debe acabar en el mensaje de error: los logs de arranque se
// pegan en tickets y en chats.
func TestTheErrorNeverEchoesTheValue(t *testing.T) {
	valid(t)
	t.Setenv("DATABASE_URL", "mysql://user:h0rrible-p4ss@localhost/foxy")
	_, err := Load()
	if err == nil {
		t.Fatal("se esperaba un error")
	}
	if strings.Contains(err.Error(), "h0rrible-p4ss") {
		t.Fatalf("la contraseña se filtró al error: %v", err)
	}
}

func TestEveryProblemIsReportedAtOnce(t *testing.T) {
	valid(t)
	t.Setenv("DATABASE_URL", "")
	t.Setenv("SUPABASE_SECRET_KEY", "")
	t.Setenv("LOG_LEVEL", "verbose")
	_, err := Load()
	if err == nil {
		t.Fatal("se esperaba un error")
	}
	for _, want := range []string{"DATABASE_URL", "SUPABASE_SECRET_KEY", "LOG_LEVEL"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("falta %s en el informe: %v", want, err)
		}
	}
}

func TestTheSharedSecretIsOnlyOptionalWithStubOrInsecure(t *testing.T) {
	valid(t)
	t.Setenv("AI_SERVICE_TOKEN", "")
	if _, err := Load(); err == nil {
		t.Fatal("sin token y apuntando al ai-service real debería abortar")
	}

	valid(t)
	t.Setenv("AI_SERVICE_TOKEN", "")
	t.Setenv("AI_SERVICE_URL", "stub")
	if _, err := Load(); err != nil {
		t.Fatalf("stub no habla con nadie, no necesita token: %v", err)
	}

	valid(t)
	t.Setenv("AI_SERVICE_TOKEN", "")
	t.Setenv("ALLOW_INSECURE", "true")
	if _, err := Load(); err != nil {
		t.Fatalf("ALLOW_INSECURE es la salida de emergencia de desarrollo: %v", err)
	}
}

func TestTheOldSupabaseSecretNameStillWorks(t *testing.T) {
	valid(t)
	t.Setenv("SUPABASE_SECRET_KEY", "")
	t.Setenv("SUPABASE_SERVICE_ROLE_KEY", "vieja")
	c, err := Load()
	if err != nil {
		t.Fatalf("el nombre viejo debería seguir valiendo: %v", err)
	}
	if c.SupabaseServiceKey != "vieja" {
		t.Errorf("no tomó el nombre viejo: %q", c.SupabaseServiceKey)
	}
}
