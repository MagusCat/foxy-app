package httpx

import (
	"net/http"
	"strconv"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/google/uuid"
)

const invalidID = "identificador inválido"

// PathUUID reads a {name} from the route and parses it to a uuid. On failure
// it's a 400, not a 500.
func PathUUID(r *http.Request, name string) (uuid.UUID, error) {
	id, err := uuid.Parse(r.PathValue(name))
	if err != nil {
		return uuid.Nil, apperr.NewValidation().Add(name, invalidID).Err()
	}
	return id, nil
}

// QueryUUID reads an optional uuid query parameter. It returns nil when absent
// (a valid "no filter") and a 400 when present but malformed.
func QueryUUID(r *http.Request, name string) (*uuid.UUID, error) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil, apperr.NewValidation().Add(name, invalidID).Err()
	}
	return &id, nil
}

// QueryInt16 reads an optional smallint query parameter. It returns nil when
// absent (a valid "no filter") and a 400 when present but malformed or out of range.
func QueryInt16(r *http.Request, name string) (*int16, error) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil, nil
	}
	n, err := strconv.ParseInt(raw, 10, 16)
	if err != nil {
		return nil, apperr.NewValidation().Add(name, invalidID).Err()
	}
	v := int16(n)
	return &v, nil
}

// QueryInt reads a numeric query parameter with a default and a cap.
func QueryInt(r *http.Request, name string, def, maxN int) int {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return def
	}
	if n > maxN {
		return maxN
	}
	return n
}
