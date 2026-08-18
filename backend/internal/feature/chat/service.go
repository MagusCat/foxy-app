package chat

import (
	"context"

	"github.com/foxy-app/backend/internal/platform/aiclient"
	"github.com/foxy-app/backend/internal/platform/page"
	"github.com/google/uuid"
)

// ActivityFunc records that the user had activity (streak). It's injected from
// main so chat isn't coupled to the profile module.
type ActivityFunc func(ctx context.Context, userID uuid.UUID)

type Service struct {
	repo       *Repository
	ai         *aiclient.Client
	activity   ActivityFunc
	basePrompt string
}

func NewService(repo *Repository, ai *aiclient.Client, activity ActivityFunc, basePrompt string) *Service {
	return &Service{repo: repo, ai: ai, activity: activity, basePrompt: basePrompt}
}

// contextWindow is how many recent messages are sent to the AI as context.
const contextWindow = 20

func (s *Service) ListConversations(ctx context.Context, userID uuid.UUID, zoneID *uuid.UUID, rawCursor string, limit int) ([]Conversation, string, error) {
	c, err := page.Decode(rawCursor)
	if err != nil {
		return nil, "", err
	}
	return s.repo.ListConversations(ctx, userID, zoneID, c, limit)
}

func (s *Service) CreateConversation(ctx context.Context, userID uuid.UUID, req CreateConversationRequest) (*Conversation, error) {
	return s.repo.CreateConversation(ctx, userID, req.ZoneID, req.Title)
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
func (s *Service) StreamReply(ctx context.Context, userID uuid.UUID, conv *Conversation, content string, onToken func(string)) (*Message, error) {
	if _, err := s.repo.InsertMessage(ctx, conv.ID, roleUser, content); err != nil {
		return nil, err
	}

	pc, err := s.repo.GatherContext(ctx, userID, conv.ZoneID, conv.ID)
	if err != nil {
		return nil, err
	}
	recent, err := s.repo.RecentMessages(ctx, conv.ID, contextWindow)
	if err != nil {
		return nil, err
	}
	aiReq := aiclient.ChatRequest{System: buildSystemPrompt(s.basePrompt, pc)}
	for _, m := range recent {
		aiReq.Messages = append(aiReq.Messages, aiclient.Message{Role: m.Role, Content: m.Content})
	}

	full, aiErr := s.ai.StreamChat(ctx, aiReq, onToken)

	// Persist what was generated even if the client disconnected midway (it's
	// already paid for). WithoutCancel: don't inherit the request's cancellation.
	var assistant *Message
	if full != "" {
		saveCtx := context.WithoutCancel(ctx)
		assistant, err = s.repo.InsertMessage(saveCtx, conv.ID, roleAssistant, full)
		if err != nil {
			return nil, err
		}
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
