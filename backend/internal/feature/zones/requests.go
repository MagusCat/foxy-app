package zones

import (
	"strings"

	"github.com/foxy-app/backend/internal/platform/apperr"
)

type CreateZoneRequest struct {
	Name            string  `json:"name"`
	Subject         *string `json:"subject"`
	IsCollaborative bool    `json:"is_collaborative"`
}

func (r CreateZoneRequest) Validate() error {
	v := apperr.NewValidation()
	if n := strings.TrimSpace(r.Name); n == "" || len(n) > 100 {
		v.Add("name", "requerido, máximo 100 caracteres")
	}
	return v.Err()
}

type UpdateZoneRequest struct {
	Name    *string `json:"name"`
	Subject *string `json:"subject"`
}

func (r UpdateZoneRequest) Validate() error {
	v := apperr.NewValidation()
	if r.Name != nil && (strings.TrimSpace(*r.Name) == "" || len(*r.Name) > 100) {
		v.Add("name", "no puede ser vacío, máximo 100 caracteres")
	}
	return v.Err()
}

type JoinZoneRequest struct {
	Code string `json:"code"`
}

func (r JoinZoneRequest) Validate() error {
	v := apperr.NewValidation()
	if strings.TrimSpace(r.Code) == "" {
		v.Add("code", "requerido")
	}
	return v.Err()
}

type CreateObjectiveRequest struct {
	Title       string  `json:"title"`
	Description *string `json:"description"`
	Position    int     `json:"position"`
}

func (r CreateObjectiveRequest) Validate() error {
	v := apperr.NewValidation()
	if t := strings.TrimSpace(r.Title); t == "" || len(t) > 200 {
		v.Add("title", "requerido, máximo 200 caracteres")
	}
	return v.Err()
}

type UpdateObjectiveRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Position    *int    `json:"position"`
}

func (r UpdateObjectiveRequest) Validate() error {
	v := apperr.NewValidation()
	if r.Title != nil && (strings.TrimSpace(*r.Title) == "" || len(*r.Title) > 200) {
		v.Add("title", "no puede ser vacío, máximo 200 caracteres")
	}
	return v.Err()
}

type SetProgressRequest struct {
	ProgressPct int `json:"progress_pct"`
}

func (r SetProgressRequest) Validate() error {
	v := apperr.NewValidation()
	if r.ProgressPct < 0 || r.ProgressPct > 100 {
		v.Add("progress_pct", "debe estar entre 0 y 100")
	}
	return v.Err()
}
