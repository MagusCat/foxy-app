package chat

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/httpx"
)

// Pagination defaults and caps for the listing endpoints.
const (
	defaultConvLimit = 20
	maxConvLimit     = 50
	defaultMsgLimit  = 30
	maxMsgLimit      = 100
)

// heartbeatInterval keeps SSE connections alive through idle proxies while the
// AI is producing the first token.
const heartbeatInterval = 15 * time.Second

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) Routes() []httpx.Route {
	return []httpx.Route{
		{Method: http.MethodGet, Pattern: "/conversations", Handler: h.list},
		{Method: http.MethodPost, Pattern: "/conversations", Handler: httpx.HandleBody(http.StatusCreated, h.svc.CreateConversation)},
		{Method: http.MethodDelete, Pattern: "/conversations/{id}", Handler: httpx.HandleDelete(h.svc.DeleteConversation)},
		{Method: http.MethodGet, Pattern: "/conversations/{id}/messages", Handler: h.listMessages},
		// The only endpoint that responds over SSE and costs money (Paid -> rate-limit;
		// Stream -> no global timeout, which would kill the streaming).
		{Method: http.MethodPost, Pattern: "/conversations/{id}/messages", Handler: h.sendMessage, Paid: true, Stream: true},
	}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	uid, err := httpx.RequireUser(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	zoneID, err := httpx.QueryUUID(r, "zone_id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	limit := httpx.QueryInt(r, "limit", defaultConvLimit, maxConvLimit)
	list, next, err := h.svc.ListConversations(r.Context(), uid, zoneID, r.URL.Query().Get("cursor"), limit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WritePage(w, r, list, next)
}

func (h *Handler) listMessages(w http.ResponseWriter, r *http.Request) {
	uid, err := httpx.RequireUser(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	id, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	limit := httpx.QueryInt(r, "limit", defaultMsgLimit, maxMsgLimit)
	list, next, err := h.svc.ListMessages(r.Context(), uid, id, r.URL.Query().Get("cursor"), limit)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WritePage(w, r, list, next)
}

// sendMessage responds over SSE. Before switching to streaming it validates and
// verifies ownership of the conversation, so it can return a normal JSON error if
// something fails prior to the stream.
func (h *Handler) sendMessage(w http.ResponseWriter, r *http.Request) {
	req, err := httpx.Decode[SendMessageRequest](w, r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	uid, err := httpx.RequireUser(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	convID, err := httpx.PathUUID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	conv, err := h.svc.Conversation(r.Context(), uid, convID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.WriteError(w, r, apperr.Internal(fmt.Errorf("the ResponseWriter does not support streaming")))
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // avoid buffering in proxies
	w.WriteHeader(http.StatusOK)

	sw := &sseWriter{w: w, f: flusher}

	// Heartbeat: if the AI is slow to emit the first token, an SSE comment every
	// 15s keeps proxies from dropping the connection for inactivity.
	stop := make(chan struct{})
	go sw.heartbeat(stop)

	onToken := func(tok string) {
		sw.event("token", map[string]string{"content": tok})
	}
	assistant, err := h.svc.StreamReply(r.Context(), uid, conv, req.Content, onToken)
	close(stop) // stop the heartbeat before the final event

	if err != nil {
		e := apperr.As(err)
		sw.event("error", map[string]string{"code": e.Code, "message": e.Message})
		return
	}
	done := map[string]any{}
	if assistant != nil {
		done["message_id"] = assistant.ID
	}
	sw.event("done", done)
}

// sseWriter serializes the SSE writes: the heartbeat and the tokens run in
// different goroutines, so the mutex prevents an interleaved write.
type sseWriter struct {
	mu sync.Mutex
	w  http.ResponseWriter
	f  http.Flusher
}

func (s *sseWriter) event(name string, data any) {
	b, _ := json.Marshal(data)
	s.mu.Lock()
	defer s.mu.Unlock()
	fmt.Fprintf(s.w, "event: %s\ndata: %s\n\n", name, b)
	s.f.Flush()
}

func (s *sseWriter) heartbeat(stop <-chan struct{}) {
	t := time.NewTicker(heartbeatInterval)
	defer t.Stop()
	for {
		select {
		case <-stop:
			return
		case <-t.C:
			s.mu.Lock()
			fmt.Fprint(s.w, ": keepalive\n\n") // SSE comments start with ':'
			s.f.Flush()
			s.mu.Unlock()
		}
	}
}
