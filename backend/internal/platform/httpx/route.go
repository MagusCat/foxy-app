package httpx

import "net/http"

// Route describes an endpoint a module exposes. main.go decides how to mount it
// (auth always; rate-limit only when Paid).
type Route struct {
	Method  string           // "GET", "POST", ...
	Pattern string           // path after /api/v1, e.g. "/notebooks/{id}"
	Handler http.HandlerFunc // the module's handler
	Paid    bool             // true = goes through the rate-limit (endpoints that call the AI)
	Stream  bool             // true = SSE response; exempt from the global timeout
}
