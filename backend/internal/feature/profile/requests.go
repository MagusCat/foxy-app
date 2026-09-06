package profile

import (
	"encoding/json"
	"strings"

	"github.com/foxy-app/backend/internal/platform/apperr"
)

const (
	maxDisplayName        = 80
	maxAvatarURL          = 500
	maxMainGoal           = 500
	maxCustomInstructions = 2000
	maxPreferences        = 4000
)

// UpdateProfileRequest is a PATCH: everything optional, pointers to know what the
// client sent. It's never decoded onto Profile so it can't write id or system_role.
type UpdateProfileRequest struct {
	DisplayName        *string         `json:"display_name"`
	AvatarURL          *string         `json:"avatar_url"`
	UserKind           *string         `json:"user_kind"`
	ProfessionID       *int16          `json:"profession_id"`
	AcademicLevel      *string         `json:"academic_level"`
	MainGoal           *string         `json:"main_goal"`
	CustomInstructions *string         `json:"custom_instructions"`
	Preferences        json.RawMessage `json:"preferences"`
}

func (r UpdateProfileRequest) Validate() error {
	v := apperr.NewValidation()
	if r.DisplayName != nil && len(strings.TrimSpace(*r.DisplayName)) > maxDisplayName {
		v.Add("display_name", "máximo 80 caracteres")
	}
	if r.AvatarURL != nil && len(*r.AvatarURL) > maxAvatarURL {
		v.Add("avatar_url", "máximo 500 caracteres")
	}
	if r.UserKind != nil && !validUserKinds[*r.UserKind] {
		v.Add("user_kind", "valor no válido")
	}
	if r.AcademicLevel != nil && !validAcademicLevels[*r.AcademicLevel] {
		v.Add("academic_level", "valor no válido")
	}
	if r.MainGoal != nil && len(*r.MainGoal) > maxMainGoal {
		v.Add("main_goal", "máximo 500 caracteres")
	}
	if r.CustomInstructions != nil && len(*r.CustomInstructions) > maxCustomInstructions {
		v.Add("custom_instructions", "máximo 2000 caracteres")
	}
	if r.Preferences != nil && (len(r.Preferences) > maxPreferences || !json.Valid(r.Preferences)) {
		v.Add("preferences", "debe ser JSON válido, máximo 4000 caracteres")
	}
	return v.Err()
}

// CreateProfessionRequest creates a catalog profession if it doesn't exist.
type CreateProfessionRequest struct {
	Name string `json:"name"`
}

func (r CreateProfessionRequest) Validate() error {
	v := apperr.NewValidation()
	if n := strings.TrimSpace(r.Name); n == "" || len(n) > 60 {
		v.Add("name", "requerido, máximo 60 caracteres")
	}
	return v.Err()
}
