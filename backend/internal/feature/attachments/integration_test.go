package attachments

import (
	"context"
	"errors"
	"testing"

	"github.com/foxy-app/backend/internal/platform/apperr"
	"github.com/foxy-app/backend/internal/platform/dbtest"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestForeignUserGets404 confirms a user cannot reach another user's attachment.
func TestForeignUserGets404(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	att, err := repo.Insert(ctx, alice, RegisterRequest{StoragePath: alice.String() + "/doc.pdf", FileName: "doc.pdf"})
	if err != nil {
		t.Fatalf("Alice could not register her attachment: %v", err)
	}

	if _, err := repo.Get(ctx, bob, att.ID); !errors.Is(err, apperr.ErrNotFound) {
		t.Fatalf("Bob got Alice's attachment (expected NOT_FOUND): %v", err)
	}
	if _, err := repo.Get(ctx, alice, att.ID); err != nil {
		t.Fatalf("Alice could not see her own attachment: %v", err)
	}
}

// VisibleIDs is an authorization boundary, so it gets the same foreign-user net
// as every other query, plus the scoping only it has.

func TestVisibleIDsNeverLeaksAnotherUsersFile(t *testing.T) {
	pool, alice, bob := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	// Both are in the same study notebook: sharing a notebook must not share files.
	notebook := seedNotebook(t, pool)
	aliceConv := seedConversation(t, pool, alice, &notebook)
	bobConv := seedConversation(t, pool, bob, &notebook)
	aliceFile := seedReadyAttachment(t, repo, alice, aliceConv)
	bobFile := seedReadyAttachment(t, repo, bob, bobConv)

	ids, err := repo.VisibleIDs(ctx, bob, &notebook, &bobConv)
	if err != nil {
		t.Fatalf("VisibleIDs failed: %v", err)
	}
	if contains(ids, aliceFile) {
		t.Fatal("Bob can search Alice's file: the AI would quote it back to him")
	}
	if !contains(ids, bobFile) {
		t.Fatal("Bob cannot search his own file")
	}
}

func TestVisibleIDsSkipsWhatHasNoTextYet(t *testing.T) {
	pool, alice, _ := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	conv := seedConversation(t, pool, alice, nil)
	pending, err := repo.Insert(ctx, alice, RegisterRequest{
		ConversationID: &conv, StoragePath: alice.String() + "/pending.pdf", FileName: "pending.pdf",
	})
	if err != nil {
		t.Fatalf("could not register: %v", err)
	}
	ready := seedReadyAttachment(t, repo, alice, conv)

	ids, err := repo.VisibleIDs(ctx, alice, nil, &conv)
	if err != nil {
		t.Fatalf("VisibleIDs failed: %v", err)
	}
	if contains(ids, pending.ID) {
		t.Error("an attachment still being extracted has no chunks to search")
	}
	if !contains(ids, ready) {
		t.Error("the extracted attachment should be searchable")
	}
}

func TestVisibleIDsScopes(t *testing.T) {
	pool, alice, _ := dbtest.Setup(t)
	ctx := context.Background()
	repo := NewRepository(pool)

	notebook := seedNotebook(t, pool)
	inNotebook := seedConversation(t, pool, alice, &notebook)
	loose := seedConversation(t, pool, alice, nil)
	notebookFile := seedReadyAttachment(t, repo, alice, inNotebook)
	looseFile := seedReadyAttachment(t, repo, alice, loose)

	cases := []struct {
		name               string
		notebookID, convID *uuid.UUID
		want, notWant      uuid.UUID
	}{
		{"by conversation", nil, &loose, looseFile, notebookFile},
		{"by notebook", &notebook, nil, notebookFile, looseFile},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ids, err := repo.VisibleIDs(ctx, alice, c.notebookID, c.convID)
			if err != nil {
				t.Fatalf("VisibleIDs failed: %v", err)
			}
			if !contains(ids, c.want) {
				t.Errorf("missing the attachment of this scope: %v", ids)
			}
			if contains(ids, c.notWant) {
				t.Errorf("an attachment from another scope leaked in: %v", ids)
			}
		})
	}

	// No scope means no search: a personal chat with no notebook must not open up
	// everything the user ever uploaded.
	ids, err := repo.VisibleIDs(ctx, alice, nil, nil)
	if err != nil {
		t.Fatalf("VisibleIDs failed: %v", err)
	}
	if len(ids) != 0 {
		t.Errorf("without a scope it should return nothing, got %d", len(ids))
	}
}

func seedNotebook(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		`insert into notebooks (name) values ('Cálculo') returning id`).Scan(&id)
	if err != nil {
		t.Fatalf("could not seed the notebook: %v", err)
	}
	return id
}

func seedConversation(t *testing.T, pool *pgxpool.Pool, user uuid.UUID, notebook *uuid.UUID) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(),
		`insert into conversations (user_id, notebook_id) values ($1, $2) returning id`, user, notebook).Scan(&id)
	if err != nil {
		t.Fatalf("could not seed the conversation: %v", err)
	}
	return id
}

func seedReadyAttachment(t *testing.T, repo *Repository, user, conv uuid.UUID) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	att, err := repo.Insert(ctx, user, RegisterRequest{
		ConversationID: &conv,
		StoragePath:    user.String() + "/" + uuid.NewString() + "/apuntes.txt",
		FileName:       "apuntes.txt",
	})
	if err != nil {
		t.Fatalf("could not register the attachment: %v", err)
	}
	if err := repo.SetExtracted(ctx, att.ID, "texto extraído", statusReady); err != nil {
		t.Fatalf("could not mark it extracted: %v", err)
	}
	return att.ID
}

func contains(ids []uuid.UUID, want uuid.UUID) bool {
	for _, id := range ids {
		if id == want {
			return true
		}
	}
	return false
}
