// Package profile handles the user's profile (including the AI config and the
// streak) and the profession and subject catalogs.
package profile

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Profile mirrors the profiles row. Optional fields are pointers to distinguish
// "no value" from "empty". user_kind stays a DB enum; academic_level is now a
// text column with a CHECK.
type Profile struct {
	ID                 uuid.UUID       `db:"id" json:"id"`
	DisplayName        *string         `db:"display_name" json:"display_name"`
	AvatarURL          *string         `db:"avatar_url" json:"avatar_url"`
	SystemRole         string          `db:"system_role" json:"system_role"`
	UserKind           *string         `db:"user_kind" json:"user_kind"`
	ProfessionID       *int16          `db:"profession_id" json:"profession_id"`
	AcademicLevel      *string         `db:"academic_level" json:"academic_level"`
	MainGoal           *string         `db:"main_goal" json:"main_goal"`
	CustomInstructions *string         `db:"custom_instructions" json:"custom_instructions"`
	CurrentStreak      int             `db:"current_streak" json:"current_streak"`
	LongestStreak      int             `db:"longest_streak" json:"longest_streak"`
	LastActiveDate     *time.Time      `db:"last_active_date" json:"last_active_date"`
	StreakFreezes      int16           `db:"streak_freezes" json:"streak_freezes"`
	StreakFrozenDays   []time.Time     `db:"streak_frozen_days" json:"streak_frozen_days"`
	Preferences        json.RawMessage `db:"preferences" json:"preferences"`
	CreatedAt          time.Time       `db:"created_at" json:"created_at"`
}

// Enum values allowed by the DB (user_kind / academic_level).
var (
	validUserKinds      = map[string]bool{"student": true, "teacher": true, "professional": true}
	validAcademicLevels = map[string]bool{
		"primaria": true, "secundaria": true, "preparatoria": true, "tecnico": true,
		"universidad": true, "posgrado": true, "curso": true, "autodidacta": true,
	}
)

type Profession struct {
	ID   int16  `db:"id" json:"id"`
	Slug string `db:"slug" json:"slug"`
	Name string `db:"name" json:"name"`
}

type Subject struct {
	ID   int16  `db:"id" json:"id"`
	Slug string `db:"slug" json:"slug"`
	Name string `db:"name" json:"name"`
}
