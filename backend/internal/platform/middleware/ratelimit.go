package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/httpx"
	"github.com/foxy-app/backend/internal/platform/reqctx"
	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

// RateLimiter limits, per user, the endpoints that cost money (AI). In-memory:
// good for a single instance. If it scales horizontally, move to Redis.
type RateLimiter struct {
	mu      sync.Mutex
	buckets map[uuid.UUID]*bucket
	limit   rate.Limit
	burst   int
}

type bucket struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// NewRateLimiter allows `perMinute` requests per user, with a `burst` allowance.
// It starts a janitor that discards idle buckets so memory doesn't leak.
func NewRateLimiter(perMinute, burst int) *RateLimiter {
	rl := &RateLimiter{
		buckets: make(map[uuid.UUID]*bucket),
		limit:   rate.Limit(float64(perMinute) / 60.0),
		burst:   burst,
	}
	go rl.janitor()
	return rl
}

func (rl *RateLimiter) limiterFor(id uuid.UUID) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	b, ok := rl.buckets[id]
	if !ok {
		b = &bucket{limiter: rate.NewLimiter(rl.limit, rl.burst)}
		rl.buckets[id] = b
	}
	b.lastSeen = time.Now()
	return b.limiter
}

// janitor drops buckets with no recent activity every 10 minutes.
func (rl *RateLimiter) janitor() {
	for range time.Tick(10 * time.Minute) {
		cutoff := time.Now().Add(-15 * time.Minute)
		rl.mu.Lock()
		for id, b := range rl.buckets {
			if b.lastSeen.Before(cutoff) {
				delete(rl.buckets, id)
			}
		}
		rl.mu.Unlock()
	}
}

// MaxConcurrent caps how many requests can be inside the handler at once. The
// per-user rate limiter does not bound this: an SSE stream lives for as long as
// the model takes to answer, and those routes carry no WriteTimeout, so a client
// that opens connections and never reads would otherwise pin goroutines and
// buffers indefinitely. Over the limit it is a clean 429, not a slow death.
func MaxConcurrent(n int) func(http.Handler) http.Handler {
	slots := make(chan struct{}, n)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			select {
			case slots <- struct{}{}:
				defer func() { <-slots }()
				next.ServeHTTP(w, r)
			default:
				httpx.WriteError(w, r, apperr.ErrRateLimited)
			}
		})
	}
}

// Middleware goes AFTER auth: it needs the user from the context.
func (rl *RateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, ok := reqctx.UserFrom(r.Context())
		if !ok {
			httpx.WriteError(w, r, apperr.ErrUnauthenticated)
			return
		}
		if !rl.limiterFor(user.ID).Allow() {
			httpx.WriteError(w, r, apperr.ErrRateLimited)
			return
		}
		next.ServeHTTP(w, r)
	})
}
