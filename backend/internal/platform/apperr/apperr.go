// Package apperr defines the typed domain errors that cross the layers. The
// service returns these errors; the handler maps them to HTTP via httpx.
package apperr

import (
	"errors"
	"fmt"
	"net/http"
)

// Field is a single error about one input field.
type Field struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Error is a domain error carrying its stable code and its HTTP status.
type Error struct {
	Code    string  // stable, for the mobile client (don't translate or change lightly)
	Message string  // human-readable
	Status  int     // HTTP status to return
	Details []Field // per-field errors (validation only)
	wrapped error   // original cause, for logging; never sent to the client
}

func (e *Error) Error() string {
	if e.wrapped != nil {
		return fmt.Sprintf("%s: %v", e.Code, e.wrapped)
	}
	return e.Code
}

func (e *Error) Unwrap() error { return e.wrapped }

// Wrap attaches the original cause without exposing it to the client.
func (e *Error) Wrap(cause error) *Error {
	c := *e
	c.wrapped = cause
	return &c
}

// Base error constructors. They are compared with errors.Is against these
// variables even when they carry a wrapped cause.
var (
	ErrUnauthenticated = &Error{Code: "UNAUTHENTICATED", Message: "Autenticación requerida", Status: http.StatusUnauthorized}
	ErrForbidden       = &Error{Code: "FORBIDDEN", Message: "No tienes permiso sobre este recurso", Status: http.StatusForbidden}
	ErrNotFound        = &Error{Code: "NOT_FOUND", Message: "Recurso no encontrado", Status: http.StatusNotFound}
	ErrConflict        = &Error{Code: "CONFLICT", Message: "El recurso ya existe o está en conflicto", Status: http.StatusConflict}
	ErrPayloadTooLarge = &Error{Code: "PAYLOAD_TOO_LARGE", Message: "El contenido excede el tamaño permitido", Status: http.StatusRequestEntityTooLarge}
	ErrRateLimited     = &Error{Code: "RATE_LIMITED", Message: "Demasiadas solicitudes, intenta más tarde", Status: http.StatusTooManyRequests}
	ErrAIUnavailable   = &Error{Code: "AI_UNAVAILABLE", Message: "El servicio de IA no está disponible", Status: http.StatusBadGateway}
	ErrInternal        = &Error{Code: "INTERNAL", Message: "Error interno", Status: http.StatusInternalServerError}
)

// Is lets errors.Is(err, apperr.ErrNotFound) compare by code, so a copy carrying
// a wrapped cause still matches its base variable.
func (e *Error) Is(target error) bool {
	var t *Error
	if errors.As(target, &t) {
		return e.Code == t.Code
	}
	return false
}

// Conflict builds a CONFLICT with a custom message (e.g. "duplicate join code").
func Conflict(msg string) *Error {
	return &Error{Code: "CONFLICT", Message: msg, Status: http.StatusConflict}
}

// NotFound builds a NOT_FOUND with a custom message. It matches errors.Is against
// ErrNotFound (same code), so callers can still compare with the base variable.
func NotFound(msg string) *Error {
	return &Error{Code: "NOT_FOUND", Message: msg, Status: http.StatusNotFound}
}

// Internal wraps any unexpected error as a 500 without exposing the cause.
func Internal(cause error) *Error { return ErrInternal.Wrap(cause) }

// Validation accumulates field errors and produces a VALIDATION_ERROR (400).
type Validation struct {
	details []Field
}

func NewValidation() *Validation { return &Validation{} }

func (v *Validation) Add(field, message string) *Validation {
	v.details = append(v.details, Field{Field: field, Message: message})
	return v
}

// Err returns nil if there were no errors, or the accumulated validation *Error.
func (v *Validation) Err() error {
	if len(v.details) == 0 {
		return nil
	}
	return &Error{
		Code:    "VALIDATION_ERROR",
		Message: "Datos inválidos",
		Status:  http.StatusBadRequest,
		Details: v.details,
	}
}

// As extracts an *Error from any error. If it isn't one, it wraps it as internal.
// The handler uses this to always have an *Error to map.
func As(err error) *Error {
	var e *Error
	if errors.As(err, &e) {
		return e
	}
	return Internal(err)
}
