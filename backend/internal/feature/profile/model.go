// Package profile handles the user's profile (including the AI config and the
// streak) and the profession catalog.
package profile

import (
	"time"

	"github.com/google/uuid"
)

// Profile mirrors the profiles row. Optional fields are pointers to distinguish
// "no value" from "empty". user_kind and academic_level are DB enums, read as
// text (pgx maps enums to strings).
type Profile struct {
	ID                 uuid.UUID  `db:"id" json:"id"`
	DisplayName        *string    `db:"display_name" json:"display_name"`
	SystemRole         string     `db:"system_role" json:"system_role"`
	UserKind           *string    `db:"user_kind" json:"user_kind"`
	ProfessionID       *int16     `db:"profession_id" json:"profession_id"`
	CurrentStreak      int        `db:"current_streak" json:"current_streak"`
	LongestStreak      int        `db:"longest_streak" json:"longest_streak"`
	LastActiveDate     *time.Time `db:"last_active_date" json:"last_active_date"`
	AcademicLevel      *string    `db:"academic_level" json:"academic_level"`
	StudyTimeAvgMin    *int       `db:"study_time_avg_min" json:"study_time_avg_min"`
	MainGoal           *string    `db:"main_goal" json:"main_goal"`
	CustomInstructions *string    `db:"custom_instructions" json:"custom_instructions"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
}

// Enum values allowed by the DB (user_kind / academic_level).
var (
	validUserKinds      = map[string]bool{"student": true, "teacher": true, "professional": true}
	validAcademicLevels = map[string]bool{
		"secundaria": true, "preparatoria": true, "universidad": true,
		"posgrado": true, "autodidacta": true,
	}
)

type Profession struct {
	ID   int16  `db:"id" json:"id"`
	Slug string `db:"slug" json:"slug"`
	Name string `db:"name" json:"name"`
}
