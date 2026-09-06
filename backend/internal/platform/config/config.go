// Package config loads configuration from environment variables. If a secret is
// missing, the process refuses to start: better to fail at boot than mid-request.
//
// Lo mismo vale para un valor mal escrito. Antes, un RATE_LIMIT_PER_MINUTE=abc o
// un ALLOW_INSECURE=yes se descartaban en silencio y el proceso arrancaba con el
// valor por defecto: el operador creía haber configurado algo que no estaba
// puesto, y en el caso de ALLOW_INSECURE eso es la diferencia entre un servicio
// autenticado y uno abierto. Ahora cualquier variable presente pero inválida
// aborta el arranque.
package config

import (
	"fmt"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	// Host vacío escucha en todas las interfaces. Fijarlo a 127.0.0.1 deja el
	// proceso solo alcanzable desde su propia máquina, para cuando hay un proxy
	// delante y nada más debería llegar al puerto.
	Host               string
	Port               string
	DatabaseURL        string
	SupabaseURL        string
	SupabaseServiceKey string // secret, never leaves the backend
	SupabaseJWKSURL    string
	SupabaseJWTIssuer  string
	AIServiceURL       string
	AIServiceToken     string // HS256 signing key for the per-request ai-service token
	AllowInsecure      bool   // dev escape hatch: lets the shared secret be empty
	LogLevel           string
	StorageBucket      string
	AllowedOrigins     []string

	RateLimitPerMinute int
	RateLimitBurst     int
	// SSE routes carry no WriteTimeout, so nothing else bounds how many can be open.
	MaxConcurrentStreams int
	RequestTimeout       time.Duration
	ShutdownTimeout      time.Duration
	DBMaxConns           int32
}

// LogLevels son los que entiende setupLogger. Cualquier otro se rechaza en vez de
// caer a info: un nivel mal escrito se manifiesta como líneas que faltan, que es
// de las cosas más caras de diagnosticar.
var LogLevels = []string{"debug", "info", "warn", "error"}

func Load() (*Config, error) {
	var l loader

	c := &Config{
		Host:                 os.Getenv("HOST"),
		Port:                 l.str("PORT", "8080"),
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		SupabaseURL:          strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"),
		SupabaseServiceKey:   firstEnv("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
		AIServiceURL:         l.str("AI_SERVICE_URL", "http://localhost:8000"),
		AIServiceToken:       os.Getenv("AI_SERVICE_TOKEN"),
		AllowInsecure:        l.boolean("ALLOW_INSECURE", false),
		LogLevel:             l.oneOf("LOG_LEVEL", "info", LogLevels...),
		StorageBucket:        l.str("STORAGE_BUCKET", "attachments"),
		RateLimitPerMinute:   l.integer("RATE_LIMIT_PER_MINUTE", 30),
		RateLimitBurst:       l.integer("RATE_LIMIT_BURST", 10),
		MaxConcurrentStreams: l.integer("MAX_CONCURRENT_STREAMS", 256),
		RequestTimeout:       l.duration("REQUEST_TIMEOUT", 30*time.Second),
		ShutdownTimeout:      l.duration("SHUTDOWN_TIMEOUT", 10*time.Second),
		DBMaxConns:           int32(l.integer("DB_MAX_CONNS", 10)),
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
	require("SUPABASE_SECRET_KEY", c.SupabaseServiceKey)
	// Without it the ai-service — which holds the Supabase service key and the
	// database — is open to whoever can reach its port.
	if !c.AllowInsecure && c.AIServiceURL != "stub" {
		require("AI_SERVICE_TOKEN", c.AIServiceToken)
	}
	if len(missing) > 0 {
		l.problems = append(l.problems,
			"faltan variables obligatorias: "+strings.Join(missing, ", "))
	}

	// Solo el esquema. Que el host conteste es cosa de la primera petición; lo que
	// se caza aquí es el error de copiar y pegar, que es el que de verdad pasa.
	l.prefix("DATABASE_URL", c.DatabaseURL, "postgresql://", "postgres://")
	l.prefix("SUPABASE_URL", c.SupabaseURL, "https://", "http://")
	if c.AIServiceURL != "stub" {
		l.prefix("AI_SERVICE_URL", c.AIServiceURL, "https://", "http://")
	}
	if p, err := strconv.Atoi(c.Port); err != nil || p < 1 || p > 65535 {
		l.reject("PORT", "se esperaba un número entre 1 y 65535")
	}
	// Un burst por debajo del ritmo sostenido no es un burst: el limitador
	// rechazaría peticiones que el propio ritmo permite.
	if c.RateLimitBurst > c.RateLimitPerMinute {
		l.reject("RATE_LIMIT_BURST", "no puede superar a RATE_LIMIT_PER_MINUTE")
	}

	if err := l.err(); err != nil {
		return nil, err
	}

	// JWKS and issuer are derived from SUPABASE_URL; both can be overridden.
	c.SupabaseJWKSURL = l.str("SUPABASE_JWKS_URL", c.SupabaseURL+"/auth/v1/.well-known/jwks.json")
	c.SupabaseJWTIssuer = l.str("SUPABASE_JWT_ISSUER", c.SupabaseURL+"/auth/v1")
	c.AllowedOrigins = splitCSV(l.str("ALLOWED_ORIGINS", "*"))
	return c, nil
}

// loader lee el entorno y va apuntando todo lo que encuentra mal, para que una
// sola ejecución liste los problemas en vez de uno por reinicio.
type loader struct{ problems []string }

// reject nunca incluye el valor: DATABASE_URL lleva la contraseña dentro y
// SUPABASE_SECRET_KEY es un secreto. El nombre y lo que se esperaba bastan.
func (l *loader) reject(key, expected string) {
	l.problems = append(l.problems, key+": "+expected)
}

func (l *loader) err() error {
	if len(l.problems) == 0 {
		return nil
	}
	return fmt.Errorf("configuración inválida:\n  - %s", strings.Join(l.problems, "\n  - "))
}

// str devuelve fallback si no está puesta. Una cadena no puede venir malformada,
// así que aquí no hay nada que rechazar.
func (l *loader) str(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func (l *loader) oneOf(key, fallback string, allowed ...string) string {
	v := l.str(key, fallback)
	if slices.Contains(allowed, v) {
		return v
	}
	l.reject(key, "valores aceptados: "+strings.Join(allowed, ", "))
	return fallback
}

func (l *loader) boolean(key string, fallback bool) bool {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.ParseBool(raw)
	if err != nil {
		l.reject(key, "se esperaba true o false")
		return fallback
	}
	return v
}

func (l *loader) integer(key string, fallback int) int {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := strconv.Atoi(raw)
	if err != nil || v <= 0 {
		l.reject(key, "se esperaba un entero positivo")
		return fallback
	}
	return v
}

func (l *loader) duration(key string, fallback time.Duration) time.Duration {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	v, err := time.ParseDuration(raw)
	if err != nil || v <= 0 {
		l.reject(key, "se esperaba una duración positiva con unidad, como 30s o 2m")
		return fallback
	}
	return v
}

// prefix valida el esquema de una URL sin repetir su valor en el error.
func (l *loader) prefix(key, val string, prefixes ...string) {
	if val == "" {
		return // ya lo reporta require()
	}
	for _, p := range prefixes {
		if strings.HasPrefix(val, p) {
			return
		}
	}
	l.reject(key, "debe empezar por "+strings.Join(prefixes, " o "))
}

// firstEnv returns the first name that is set. Supabase renamed this secret from
// service_role key to secret key; both names are accepted so an existing .env keeps
// working.
func firstEnv(names ...string) string {
	for _, name := range names {
		if v := os.Getenv(name); v != "" {
			return v
		}
	}
	return ""
}

func splitCSV(s string) []string {
	var out []string
	for p := range strings.SplitSeq(s, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
