package chat

import (
	"context"
	"log/slog"

	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/page"
	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
)

// ActivityFunc records that the user had activity (streak). It's injected from
// main so chat isn't coupled to the profile module.
type ActivityFunc func(ctx context.Context, userID uuid.UUID)

// AttachmentsFunc yields the attachment ids whose text the AI may search. It's
// injected from main so chat isn't coupled to the attachments module.
type AttachmentsFunc func(ctx context.Context, userID uuid.UUID, notebookID, convID *uuid.UUID) ([]uuid.UUID, error)

type Service struct {
	repo        *Repository
	ai          *aiclient.Client
	activity    ActivityFunc
	attachments AttachmentsFunc
}

func NewService(repo *Repository, ai *aiclient.Client, activity ActivityFunc, attachments AttachmentsFunc) *Service {
	return &Service{repo: repo, ai: ai, activity: activity, attachments: attachments}
}

// contextWindow is how many recent messages are sent to the AI as context.
const contextWindow = 20

func (s *Service) ListConversations(ctx context.Context, userID uuid.UUID, notebookID *uuid.UUID, subjectID *int16, rawCursor string, limit int) ([]Conversation, string, error) {
	c, err := page.Decode(rawCursor)
	if err != nil {
		return nil, "", err
	}
	return s.repo.ListConversations(ctx, userID, notebookID, subjectID, c, limit)
}

func (s *Service) CreateConversation(ctx context.Context, userID uuid.UUID, req CreateConversationRequest) (*Conversation, error) {
	if req.Kind == "" {
		req.Kind = kindAI
	}
	return s.repo.CreateConversation(ctx, userID, req)
}

func (s *Service) SetSaved(ctx context.Context, userID, msgID uuid.UUID, saved bool) (*Message, error) {
	return s.repo.SetSaved(ctx, userID, msgID, saved)
}

func (s *Service) ListSaved(ctx context.Context, userID uuid.UUID, rawCursor string, limit int) ([]Message, string, error) {
	c, err := page.Decode(rawCursor)
	if err != nil {
		return nil, "", err
	}
	return s.repo.ListSaved(ctx, userID, c, limit)
}

func (s *Service) Conversation(ctx context.Context, userID, id uuid.UUID) (*Conversation, error) {
	return s.repo.GetConversation(ctx, userID, id)
}

func (s *Service) DeleteConversation(ctx context.Context, userID, id uuid.UUID) error {
	return s.repo.DeleteConversation(ctx, userID, id)
}

func (s *Service) ListMessages(ctx context.Context, userID, convID uuid.UUID, rawCursor string, limit int) ([]Message, string, error) {
	if _, err := s.repo.GetConversation(ctx, userID, convID); err != nil {
		return nil, "", err // 404 if it isn't theirs
	}
	c, err := page.Decode(rawCursor)
	if err != nil {
		return nil, "", err
	}
	return s.repo.ListMessages(ctx, convID, c, limit)
}

// StreamReply assumes conv was already verified as the user's. It saves the
// user's message, streams the AI reply token by token via onToken, and persists
// the reply when done (even if the client disconnects).
// searchableAttachments never fails the reply: losing the document context
// degrades the answer, it doesn't break the chat.
func (s *Service) searchableAttachments(ctx context.Context, userID uuid.UUID, conv *Conversation) []uuid.UUID {
	if s.attachments == nil {
		return nil
	}
	ids, err := s.attachments(ctx, userID, conv.NotebookID, &conv.ID)
	if err != nil {
		slog.ErrorContext(ctx, "could not list the attachments for the context", "error", err)
		return nil
	}
	return ids
}

func (s *Service) StreamReply(ctx context.Context, userID uuid.UUID, conv *Conversation, req SendMessageRequest, onToken func(string)) (*Message, error) {
	if _, err := s.repo.InsertUserMessage(ctx, conv.ID, userID, req.Content, req.Mode); err != nil {
		return nil, err
	}

	// The three reads are independent and they all sit between the user pressing
	// send and the first token: in series they stacked three round trips to the
	// pooler onto the perceived latency.
	var (
		pc      *aiclient.ChatContext
		recent  []Message
		visible []uuid.UUID
	)
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() (err error) {
		pc, err = s.repo.GatherContext(gctx, userID, conv.NotebookID)
		return err
	})
	g.Go(func() (err error) {
		recent, err = s.repo.RecentMessages(gctx, conv.ID, contextWindow)
		return err
	})
	g.Go(func() error {
		// Never fails the reply: see searchableAttachments.
		visible = s.searchableAttachments(gctx, userID, conv)
		return nil
	})
	if err := g.Wait(); err != nil {
		return nil, err
	}
	pc.Mode = req.Mode

	aiReq := aiclient.ChatRequest{
		Context:   *pc,
		Retrieval: aiclient.Retrieval{AttachmentIDs: visible},
	}
	for _, m := range recent {
		aiReq.Messages = append(aiReq.Messages, aiclient.Message{Role: m.Role, Content: m.Content})
	}

	full, aiErr := s.ai.StreamChat(ctx, aiReq, onToken)

	// Persist what was generated even if the client disconnected midway (it's
	// already paid for). WithoutCancel: don't inherit the request's cancellation.
	var assistant *Message
	if full != "" {
		saveCtx := context.WithoutCancel(ctx)
		saved, err := s.repo.InsertAssistantMessage(saveCtx, conv.ID, full)
		if err != nil {
			return nil, err
		}
		assistant = saved
		_ = s.repo.TouchConversation(saveCtx, conv.ID)
		if s.activity != nil {
			go s.activity(context.WithoutCancel(ctx), userID)
		}
	}
	if aiErr != nil {
		return assistant, aiErr
	}
	return assistant, nil
}
