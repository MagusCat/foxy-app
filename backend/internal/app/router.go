package app

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/foxy-app/backend/internal/feature/attachments"
	"github.com/foxy-app/backend/internal/feature/chat"
	"github.com/foxy-app/backend/internal/feature/events"
	"github.com/foxy-app/backend/internal/feature/materials"
	"github.com/foxy-app/backend/internal/feature/profile"
	"github.com/foxy-app/backend/internal/feature/topics"
	"github.com/foxy-app/backend/internal/feature/zones"
	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/auth"
	"github.com/foxy-app/backend/internal/platform/config"
	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/foxy-app/backend/internal/platform/middleware"
	"github.com/foxy-app/backend/internal/platform/storage"
	"github.com/jackc/pgx/v5/pgxpool"
)

// newRouter wires every domain module (repository -> service -> handler) and
// mounts its routes under /api/v1 with the middleware chain.
func newRouter(cfg *config.Config, pool *pgxpool.Pool, authr *auth.Authenticator) http.Handler {
	storageClient := storage.New(cfg.SupabaseURL, cfg.SupabaseServiceKey, cfg.StorageBucket)
	ai := aiclient.New(cfg.AIServiceURL)

	profileSvc := profile.NewService(profile.NewRepository(pool))
	modules := [][]httpx.Route{
		profile.NewHandler(profileSvc).Routes(),
		zones.NewHandler(zones.NewService(zones.NewRepository(pool))).Routes(),
		chat.NewHandler(chat.NewService(chat.NewRepository(pool), ai, profileSvc.RecordActivity, cfg.FoxySystemPrompt)).Routes(),
		attachments.NewHandler(attachments.NewService(attachments.NewRepository(pool), storageClient, ai)).Routes(),
		materials.NewHandler(materials.NewService(materials.NewRepository(pool), ai)).Routes(),
		events.NewHandler(events.NewService(events.NewRepository(pool))).Routes(),
		topics.NewHandler(topics.NewService(topics.NewRepository(pool))).Routes(),
	}

	rl := middleware.NewRateLimiter(cfg.RateLimitPerMinute, cfg.RateLimitBurst)
	timeout := middleware.Timeout(cfg.RequestTimeout)

	mux := http.NewServeMux()
	mux.HandleFunc(http.MethodGet+" /health", health(pool))
	for _, routes := range modules {
		for _, rt := range routes {
			mws := []func(http.Handler) http.Handler{authr.Middleware}
			if rt.Paid {
				mws = append(mws, rl.Middleware)
			}
			if !rt.Stream {
				mws = append(mws, timeout) // SSE is exempt: the streaming is long on purpose
			}
			mux.Handle(rt.Method+" /api/v1"+rt.Pattern, middleware.Chain(rt.Handler, mws...))
		}
	}

	// Global middleware (the first is the outermost).
	return middleware.Chain(mux,
		middleware.Recover, middleware.RequestID, middleware.Logger, middleware.CORS(cfg.AllowedOrigins))
}

// health reports DB reachability. No auth: it's used by health checks.
func health(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		w.Header().Set("Content-Type", "application/json")
		if err := pool.Ping(ctx); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{"status": "unavailable"})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}
}
