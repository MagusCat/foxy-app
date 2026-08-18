// Package httpx holds the shared HTTP utilities: the response envelope, the
// decode+validate of inputs, and the domain-error-to-status mapping.
package httpx

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/reqctx"
)

const maxBodyBytes = 1 << 20 // 1 MB: no JSON endpoint needs more

// Validator is implemented by each Request to validate itself.
type Validator interface {
	Validate() error
}

type meta struct {
	RequestID  string `json:"request_id"`
	NextCursor string `json:"next_cursor,omitempty"`
}

type successEnvelope struct {
	Data any  `json:"data"`
	Meta meta `json:"meta"`
}

type errorBody struct {
	Code    string         `json:"code"`
	Message string         `json:"message"`
	Details []apperr.Field `json:"details,omitempty"`
}

type errorEnvelope struct {
	Error errorBody `json:"error"`
	Meta  meta      `json:"meta"`
}

// Decode reads the JSON body into T and validates it. It caps the body at 1 MB,
// rejects unknown fields, and requires the JSON to be syntactically valid.
func Decode[T Validator](w http.ResponseWriter, r *http.Request) (T, error) {
	var v T
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&v); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			return v, apperr.ErrPayloadTooLarge
		}
		// Any malformed JSON is the client's fault -> 400.
		return v, apperr.NewValidation().Add("body", "JSON inválido: "+err.Error()).Err()
	}
	if err := v.Validate(); err != nil {
		return v, err
	}
	return v, nil
}

// WriteJSON writes a successful response with the standard envelope.
func WriteJSON(w http.ResponseWriter, r *http.Request, status int, data any) {
	write(w, status, successEnvelope{
		Data: data,
		Meta: meta{RequestID: reqctx.RequestID(r.Context())},
	})
}

// WritePage writes a list with the pagination cursor in meta.
func WritePage(w http.ResponseWriter, r *http.Request, data any, nextCursor string) {
	write(w, http.StatusOK, successEnvelope{
		Data: data,
		Meta: meta{RequestID: reqctx.RequestID(r.Context()), NextCursor: nextCursor},
	})
}

// WriteError maps any error to its envelope and status. Unknown errors fall to
// INTERNAL and are logged in full with the request-id; the client only sees the code.
func WriteError(w http.ResponseWriter, r *http.Request, err error) {
	e := apperr.As(err)
	rid := reqctx.RequestID(r.Context())
	if e.Status >= 500 {
		slog.ErrorContext(r.Context(), "request failed",
			"request_id", rid, "code", e.Code, "error", e.Error())
	}
	write(w, e.Status, errorEnvelope{
		Error: errorBody{Code: e.Code, Message: e.Message, Details: e.Details},
		Meta:  meta{RequestID: rid},
	})
}

func write(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
