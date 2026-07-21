package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"messenger/backend/internal/push"
	"messenger/backend/internal/store"
)

// handlePushVapidKey возвращает VAPID публичный ключ для подписки на frontend.
func (s *Server) handlePushVapidKey(w http.ResponseWriter, r *http.Request) {
	if !s.pusher.Enabled() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "push notifications not configured",
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"publicKey": s.pusher.PublicKey(),
	})
}

// handlePushSubscribe сохраняет Web Push подписку текущего пользователя.
func (s *Server) handlePushSubscribe(w http.ResponseWriter, r *http.Request) {
	if !s.pusher.Enabled() {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "push notifications not configured",
		})
		return
	}

	var input struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
	}

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	input.Endpoint = strings.TrimSpace(input.Endpoint)
	input.Keys.P256dh = strings.TrimSpace(input.Keys.P256dh)
	input.Keys.Auth = strings.TrimSpace(input.Keys.Auth)

	if input.Endpoint == "" || input.Keys.P256dh == "" || input.Keys.Auth == "" {
		writeError(w, http.StatusBadRequest, "endpoint, p256dh and auth are required")
		return
	}

	userID := currentUserID(r.Context())
	if err := s.store.SavePushSubscription(r.Context(), userID, input.Endpoint, input.Keys.P256dh, input.Keys.Auth); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save push subscription")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// handlePushUnsubscribe удаляет Web Push подписку.
func (s *Server) handlePushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	input.Endpoint = strings.TrimSpace(input.Endpoint)
	if input.Endpoint == "" {
		writeError(w, http.StatusBadRequest, "endpoint is required")
		return
	}

	userID := currentUserID(r.Context())
	if err := s.store.DeletePushSubscription(r.Context(), userID, input.Endpoint); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete push subscription")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// pushWebNotification отправляет Web Push уведомление получателям нового сообщения.
func (s *Server) pushWebNotification(senderID int64, recipientIDs []int64, payload push.NotifyPayload) {
	if !s.pusher.Enabled() {
		return
	}
	// Не отправляем уведомление самому отправителю
	targets := make([]int64, 0, len(recipientIDs))
	for _, id := range recipientIDs {
		if id != senderID {
			targets = append(targets, id)
		}
	}
	if len(targets) == 0 {
		return
	}
	go s.pusher.SendToUsers(context.Background(), targets, payload)
}

// messagePreview формирует краткое текстовое превью для push-уведомления.
func messagePreview(msg store.Message) string {
	switch msg.Kind {
	case "text":
		if len(msg.Text) > 100 {
			return msg.Text[:100] + "…"
		}
		if msg.Text != "" {
			return msg.Text
		}
		return "Сообщение"
	case "image":
		if msg.Text != "" {
			return "🖼 " + msg.Text
		}
		return "🖼 Фото"
	case "video":
		if msg.Text != "" {
			return "🎬 " + msg.Text
		}
		return "🎬 Видео"
	case "voice":
		return "🎤 Голосовое"
	case "video_note":
		return "📹 Видеосообщение"
	case "file":
		if msg.FileName != "" {
			return "📎 " + msg.FileName
		}
		return "📎 Файл"
	default:
		return "Новое сообщение"
	}
}
