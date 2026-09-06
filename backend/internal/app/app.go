// Package app is the composition root: it loads config, opens the pool, wires the
// domain modules, and runs the HTTP server. cmd/api only calls Run.
package app

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/foxy-app/backend/internal/platform/auth"
	"github.com/foxy-app/backend/internal/platform/config"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const readHeaderTimeout = 10 * time.Second

func Run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	setupLogger(cfg.LogLevel)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	pool, err := newPool(ctx, cfg)
	if err != nil {
		return err
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		return err // without a DB we don't start
	}

	authr, err := auth.New(ctx, cfg.SupabaseJWKSURL, cfg.SupabaseJWTIssuer)
	if err != nil {
		return err
	}

	handler, cleanup := newRouter(cfg, pool, authr)
	srv := &http.Server{
		Addr:              cfg.Host + ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: readHeaderTimeout,
		// No WriteTimeout: it would break the SSE streaming of long responses.
	}
	err = serve(ctx, srv, cfg.ShutdownTimeout)
	// After Shutdown: no handler can still be enqueueing work, so this only waits
	// for what is already running instead of racing it.
	cleanup()
	return err
}

func serve(ctx context.Context, srv *http.Server, shutdownTimeout time.Duration) error {
	errCh := make(chan error, 1)
	go func() {
		slog.Info("server listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		slog.Info("shutting down server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

// newPool tunes the pool for the Supabase pooler (pgbouncer). QueryExecModeExec
// disables named-statement caching, which breaks under a transaction-mode pooler.
func newPool(ctx context.Context, cfg *config.Config) (*pgxpool.Pool, error) {
	pc, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	pc.MaxConns = cfg.DBMaxConns
	pc.MinConns = 1
	pc.MaxConnIdleTime = 5 * time.Minute
	pc.MaxConnLifetime = time.Hour
	pc.HealthCheckPeriod = time.Minute
	pc.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec
	return pgxpool.NewWithConfig(ctx, pc)
}

func setupLogger(level string) {
	lvl := slog.LevelInfo
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl})))
}
