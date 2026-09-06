package topics

import (
	"strings"

	"github.com/foxy-app/backend/internal/platform/apperr"
)

type CreateTopicRequest struct {
	Name     string `json:"name"`
	Position int    `json:"position"`
}

func (r CreateTopicRequest) Validate() error {
	v := apperr.NewValidation()
	if n := strings.TrimSpace(r.Name); n == "" || len(n) > 120 {
		v.Add("name", "requerido, máximo 120 caracteres")
	}
	return v.Err()
}

type UpdateTopicRequest struct {
	Name     *string `json:"name"`
	Position *int    `json:"position"`
}

func (r UpdateTopicRequest) Validate() error {
	v := apperr.NewValidation()
	if r.Name != nil && (strings.TrimSpace(*r.Name) == "" || len(*r.Name) > 120) {
		v.Add("name", "no puede ser vacío, máximo 120 caracteres")
	}
	return v.Err()
}
