package httpapi

import (
	"context"
	"time"

	"messenger/backend/internal/realtime"
	"messenger/backend/internal/store"
)

func (s *Server) applyUserPresence(user store.User) store.User {
	if user.ID == 0 {
		return user
	}
	user.Online = s.hub.IsOnline(user.ID)
	return user
}

func (s *Server) applyChatPreviewPresence(chat store.ChatPreview) store.ChatPreview {
	if chat.Peer.ID > 0 {
		chat.Peer = s.applyUserPresence(chat.Peer)
	}
	for i := range chat.Participants {
		chat.Participants[i] = s.applyUserPresence(chat.Participants[i])
	}
	return chat
}

func (s *Server) applyChatDetailsPresence(chat store.ChatDetails) store.ChatDetails {
	if chat.Peer.ID > 0 {
		chat.Peer = s.applyUserPresence(chat.Peer)
	}
	for i := range chat.Participants {
		chat.Participants[i] = s.applyUserPresence(chat.Participants[i])
	}
	return chat
}

func (s *Server) broadcastPresence(ctx context.Context, userID int64, online bool) {
	related, err := s.store.ListRelatedUserIDs(ctx, userID)
	if err != nil || len(related) == 0 {
		return
	}

	var lastSeenAt *time.Time
	if !online {
		if lastSeen, err := s.store.GetLastSeenAt(ctx, userID); err == nil {
			lastSeenAt = lastSeen
		}
	}

	event := realtime.Event{
		Type: "user:presence",
		Data: map[string]any{
			"userId":     userID,
			"online":     online,
			"lastSeenAt": lastSeenAt,
		},
	}
	for _, recipientID := range related {
		s.hub.BroadcastToUser(recipientID, event)
	}
}
