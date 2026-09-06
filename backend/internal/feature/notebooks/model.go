// Package notebooks handles study notebooks (a personal notebook or a
// collaborative classroom), their members, objectives, and each user's progress.
package notebooks

import (
	"time"

	"github.com/google/uuid"
)

// Notebook member roles (member_role enum in the DB). Ownership lives in
// notebook_members.role, not in a column on notebooks.
const (
	roleOwner  = "owner"
	roleMember = "member"
)

type Notebook struct {
	ID              uuid.UUID `db:"id" json:"id"`
	Name            string    `db:"name" json:"name"`
	SubjectID       *int16    `db:"subject_id" json:"subject_id"`
	IsCollaborative bool      `db:"is_collaborative" json:"is_collaborative"`
	JoinCode        *string   `db:"join_code" json:"join_code"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

type Member struct {
	UserID      uuid.UUID `db:"user_id" json:"user_id"`
	DisplayName *string   `db:"display_name" json:"display_name"`
	Role        string    `db:"role" json:"role"`
	JoinedAt    time.Time `db:"joined_at" json:"joined_at"`
}

// Objective includes progress_pct: the progress of the requesting user (0 if not started).
type Objective struct {
	ID          uuid.UUID `db:"id" json:"id"`
	NotebookID  uuid.UUID `db:"notebook_id" json:"notebook_id"`
	Title       string    `db:"title" json:"title"`
	Description *string   `db:"description" json:"description"`
	Position    int       `db:"position" json:"position"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	ProgressPct int       `db:"progress_pct" json:"progress_pct"`
}

type Progress struct {
	ObjectiveID uuid.UUID `db:"objective_id" json:"objective_id"`
	UserID      uuid.UUID `db:"user_id" json:"user_id"`
	ProgressPct int       `db:"progress_pct" json:"progress_pct"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}
