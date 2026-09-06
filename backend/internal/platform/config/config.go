// Package config loads configuration from environment variables. If a secret is
// missing, the process refuses to start: better to fail at boot than mid-request.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Port               string
	DatabaseURL        string
	SupabaseURL        string
	SupabaseServiceKey string // secret, never leaves the backend
	SupabaseJWKSURL    string
	SupabaseJWTIssuer  string
	AIServiceURL       string
	LogLevel           string
	StorageBucket      string
	AllowedOrigins     []string

	FoxySystemPrompt string

	RateLimitPerMinute int
	RateLimitBurst     int
	RequestTimeout     time.Duration
	ShutdownTimeout    time.Duration
	DBMaxConns         int32
}

func Load() (*Config, error) {
	c := &Config{
		Port:               getenv("PORT", "8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		SupabaseURL:        strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		AIServiceURL:       getenv("AI_SERVICE_URL", "http://localhost:8000"),
		LogLevel:           getenv("LOG_LEVEL", "info"),
		StorageBucket:      getenv("STORAGE_BUCKET", "attachments"),
		FoxySystemPrompt:   os.Getenv("FOXY_SYSTEM_PROMPT"), // empty = use the base prompt file (chat/prompts/base.md)
		RateLimitPerMinute: getenvInt("RATE_LIMIT_PER_MINUTE", 30),
		RateLimitBurst:     getenvInt("RATE_LIMIT_BURST", 10),
		RequestTimeout:     getenvDuration("REQUEST_TIMEOUT", 30*time.Second),
		ShutdownTimeout:    getenvDuration("SHUTDOWN_TIMEOUT", 10*time.Second),
		DBMaxConns:         int32(getenvInt("DB_MAX_CONNS", 10)),
	}

	// Report every missing required variable at once, not one per run.
	var missing []string
	require := func(name, val string) {
		if val == "" {
			missing = append(missing, name)
		}
	}
	require("DATABASE_URL", c.DatabaseURL)
	require("SUPABASE_URL", c.SupabaseURL)
	require("SUPABASE_SERVICE_ROLE_KEY", c.SupabaseServiceKey)
	if len(missing) > 0 {
		return nil, fmt.Errorf("missing environment variables: %s", strings.Join(missing, ", "))
	}

	// JWKS and issuer are derived from SUPABASE_URL; both can be overridden.
	c.SupabaseJWKSURL = getenv("SUPABASE_JWKS_URL", c.SupabaseURL+"/auth/v1/.well-known/jwks.json")
	c.SupabaseJWTIssuer = getenv("SUPABASE_JWT_ISSUER", c.SupabaseURL+"/auth/v1")
	c.AllowedOrigins = splitCSV(getenv("ALLOWED_ORIGINS", "*"))
	return c, nil
}

func splitCSV(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return fallback
}

func getenvDuration(key string, fallback time.Duration) time.Duration {
	if v, err := time.ParseDuration(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return fallback
}
