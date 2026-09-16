package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"messenger/backend/internal/push"
	"messenger/backend/internal/realtime"
	"messenger/backend/internal/store"

	"github.com/go-chi/chi/v5"
)

type supportMessageRequest struct {
	Text string `json:"text"`
}

type supportConversationRequest struct {
	ExternalID   string `json:"externalId"`
	VisitorName  string `json:"visitorName"`
	VisitorPhone string `json:"visitorPhone"`
}

type supportEvent struct {
	Message      store.SupportMessage      `json:"message"`
	Conversation store.SupportConversation `json:"conversation"`
}

type supportAssignedEvent struct {
	Conversation store.SupportConversation `json:"conversation"`
}

func (s *Server) handleSupportListConversations(
	w http.ResponseWriter,
	r *http.Request,
) {
	items, err := s.store.ListSupportConversations(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load support conversations")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
	})
}

func (s *Server) handleSupportListMessages(
	w http.ResponseWriter,
	r *http.Request,
) {
	conversationID, err := strconv.ParseInt(
		chi.URLParam(r, "conversationID"),
		10,
		64,
	)
	if err != nil || conversationID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	conversation, err := s.store.GetSupportConversation(
		r.Context(),
		conversationID,
	)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "conversation not found")
			return
		}

		writeError(w, http.StatusInternalServerError, "failed to load conversation")
		return
	}

	messages, err := s.store.ListSupportMessages(
		r.Context(),
		conversationID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load messages")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"conversation": conversation,
		"items":        messages,
	})
}

func (s *Server) handleSupportCreateMessage(
	w http.ResponseWriter,
	r *http.Request,
) {
	userID := currentUserID(r.Context())

	isWorker, err := s.store.IsSupportWorker(
		r.Context(),
		userID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check support access")
		return
	}

	if !isWorker {
		writeError(w, http.StatusForbidden, "support access required")
		return
	}

	conversationID, err := strconv.ParseInt(
		chi.URLParam(r, "conversationID"),
		10,
		64,
	)
	if err != nil || conversationID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	var input supportMessageRequest

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	input.Text = strings.TrimSpace(input.Text)

	if input.Text == "" {
		writeError(w, http.StatusBadRequest, "message text is required")
		return
	}

	conversation, err := s.store.GetSupportConversation(
		r.Context(),
		conversationID,
	)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "conversation not found")
			return
		}

		writeError(w, http.StatusInternalServerError, "failed to load conversation")
		return
	}

	// Проверяем блокировку: если диалог назначен на другого оператора — запрещаем
	if conversation.AssignedToUserID != nil && *conversation.AssignedToUserID != userID {
		writeError(w, http.StatusConflict, "conversation is handled by another operator")
		return
	}

	// Автоматически назначаем диалог на оператора при первом ответе
	newlyAssigned := false
	if conversation.AssignedToUserID == nil {
		if err := s.store.AssignSupportConversation(r.Context(), conversationID, userID); err != nil {
			log.Printf("failed to assign support conversation: %v", err)
		} else {
			newlyAssigned = true
			// Обновляем локальную копию
			conversation.AssignedToUserID = &userID
		}
	}

	message, err := s.store.CreateSupportMessage(
		r.Context(),
		conversationID,
		"worker",
		&userID,
		input.Text,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save message")
		return
	}

	if err := s.sendSupportMessageToMedik(
		r.Context(),
		conversation.ExternalID,
		input.Text,
	); err != nil {
		log.Printf(
			"failed to send support message to SD Медик: %v",
			err,
		)
	}

	// Получаем обновлённую версию conversation (с именем оператора)
	updatedConv, convErr := s.store.GetSupportConversation(r.Context(), conversationID)
	if convErr != nil {
		updatedConv = conversation
	}

	// Уведомляем остальных операторов поддержки о новом сообщении.
	workerIDs, err := s.store.ListSupportWorkerIDs(r.Context())
	if err == nil {
		msgEvent := realtime.Event{
			Type: "support:message",
			Data: supportEvent{
				Message:      message,
				Conversation: updatedConv,
			},
		}

		for _, workerID := range workerIDs {
			if workerID == userID {
				continue
			}

			s.hub.BroadcastToUser(workerID, msgEvent)
		}

		// Если только что назначили — рассылаем событие назначения всем операторам
		if newlyAssigned {
			assignedEvent := realtime.Event{
				Type: "support:conversation:assigned",
				Data: supportAssignedEvent{
					Conversation: updatedConv,
				},
			}
			for _, workerID := range workerIDs {
				s.hub.BroadcastToUser(workerID, assignedEvent)
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": message,
	})
}

func (s *Server) handleSupportCreateConversation(
	w http.ResponseWriter,
	r *http.Request,
) {
	var input supportConversationRequest

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	conversation, err := s.store.CreateSupportConversation(
		r.Context(),
		input.ExternalID,
		input.VisitorName,
		input.VisitorPhone,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"conversation": conversation,
	})
}

type supportVisitorMessageRequest struct {
	ExternalID string `json:"external_id"`
	Message    string `json:"message"`
}

func (s *Server) handleSupportCreateVisitorMessage(
	w http.ResponseWriter,
	r *http.Request,
) {
	if s.cfg.SupportSecret == "" ||
		r.Header.Get("X-Support-Secret") != s.cfg.SupportSecret {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var input supportVisitorMessageRequest

	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	input.ExternalID = strings.TrimSpace(input.ExternalID)
	input.Message = strings.TrimSpace(input.Message)

	if input.ExternalID == "" {
		writeError(w, http.StatusBadRequest, "external_id is required")
		return
	}

	if input.Message == "" {
		writeError(w, http.StatusBadRequest, "message is required")
		return
	}

	conversation, err := s.store.GetSupportConversationByExternalID(
		r.Context(),
		input.ExternalID,
	)

	if err != nil {
		if err == store.ErrNotFound {
			conversation, err = s.store.CreateSupportConversation(
				r.Context(),
				input.ExternalID,
				"",
				"",
			)
			if err != nil {
				writeError(
					w,
					http.StatusInternalServerError,
					"failed to create conversation",
				)
				return
			}
		} else {
			writeError(
				w,
				http.StatusInternalServerError,
				"failed to load conversation",
			)
			return
		}
	}

	message, err := s.store.CreateSupportMessage(
		r.Context(),
		conversation.ID,
		"visitor",
		nil,
		input.Message,
	)
	if err != nil {
		writeError(
			w,
			http.StatusInternalServerError,
			"failed to save message",
		)
		return
	}

	workerIDs, err := s.store.ListSupportWorkerIDs(r.Context())
	if err == nil {
		event := realtime.Event{
			Type: "support:message",
			Data: supportEvent{
				Message:      message,
				Conversation: conversation,
			},
		}

		for _, workerID := range workerIDs {
			s.hub.BroadcastToUser(workerID, event)
		}

		// Web Push уведомление операторам
		s.pushSupportNotification(r.Context(), workerIDs, conversation, message)
	}

	// Уведомляем бота Макс о новом сообщении клиента
	if err := s.notifyMaxBot(r.Context(), conversation, message); err != nil {
		log.Printf("failed to notify Max bot about support message: %v", err)
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"conversation": conversation,
		"message":      message,
	})
}

// handleSupportUnassign освобождает диалог (снимает оператора).
func (s *Server) handleSupportUnassign(
	w http.ResponseWriter,
	r *http.Request,
) {
	userID := currentUserID(r.Context())

	isWorker, err := s.store.IsSupportWorker(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check support access")
		return
	}
	if !isWorker {
		writeError(w, http.StatusForbidden, "support access required")
		return
	}

	conversationID, err := strconv.ParseInt(
		chi.URLParam(r, "conversationID"),
		10,
		64,
	)
	if err != nil || conversationID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid conversation id")
		return
	}

	conversation, err := s.store.GetSupportConversation(r.Context(), conversationID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "conversation not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load conversation")
		return
	}

	// Только сам оператор может снять себя
	if conversation.AssignedToUserID == nil || *conversation.AssignedToUserID != userID {
		writeError(w, http.StatusForbidden, "you are not the assigned operator")
		return
	}

	if err := s.store.UnassignSupportConversation(r.Context(), conversationID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to unassign conversation")
		return
	}

	// Уведомляем всех операторов
	updatedConv, _ := s.store.GetSupportConversation(r.Context(), conversationID)
	workerIDs, listErr := s.store.ListSupportWorkerIDs(r.Context())
	if listErr == nil {
		assignedEvent := realtime.Event{
			Type: "support:conversation:assigned",
			Data: supportAssignedEvent{
				Conversation: updatedConv,
			},
		}
		for _, wID := range workerIDs {
			s.hub.BroadcastToUser(wID, assignedEvent)
		}
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleAdminListSupportWorkers(
	w http.ResponseWriter,
	r *http.Request,
) {
	ids, err := s.store.ListSupportWorkerIDs(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load support workers")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"items": ids,
	})
}

func (s *Server) handleAdminAddSupportWorker(
	w http.ResponseWriter,
	r *http.Request,
) {
	userID, err := strconv.ParseInt(
		chi.URLParam(r, "userID"),
		10,
		64,
	)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	// Проверяем, что такой Messenger-пользователь существует.
	if _, err := s.store.GetUserByID(r.Context(), userID); err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}

		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}

	if err := s.store.AddSupportWorker(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add support worker")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{
		"ok": true,
	})
}

func (s *Server) handleAdminRemoveSupportWorker(
	w http.ResponseWriter,
	r *http.Request,
) {
	userID, err := strconv.ParseInt(
		chi.URLParam(r, "userID"),
		10,
		64,
	)
	if err != nil || userID <= 0 {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return
	}

	if err := s.store.RemoveSupportWorker(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove support worker")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{
		"ok": true,
	})
}

func (s *Server) sendSupportMessageToMedik(
	ctx context.Context,
	externalID string,
	message string,
) error {
	if s.cfg.SupportMedikURL == "" {
		return fmt.Errorf("SUPPORT_MEDIK_URL is not configured")
	}

	if s.cfg.SupportSecret == "" {
		return fmt.Errorf("SUPPORT_SECRET is not configured")
	}

	payload := map[string]string{
		"chat_id": externalID,
		"message": message,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to encode support message: %w", err)
	}

	url := strings.TrimRight(s.cfg.SupportMedikURL, "/") +
		"/api/v1/chat/support/message"

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Support-Secret", s.cfg.SupportSecret)

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to request SD Медик: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf(
			"SD Медик returned status %s",
			resp.Status,
		)
	}

	return nil
}

// pushSupportNotification отправляет Web Push уведомление операторам о новом сообщении клиента.
func (s *Server) pushSupportNotification(
	ctx context.Context,
	workerIDs []int64,
	conversation store.SupportConversation,
	message store.SupportMessage,
) {
	if !s.pusher.Enabled() || len(workerIDs) == 0 {
		return
	}

	visitorName := conversation.VisitorName
	if visitorName == "" {
		visitorName = fmt.Sprintf("Посетитель #%d", conversation.ID)
	}

	preview := message.Text
	if len(preview) > 80 {
		preview = preview[:80] + "…"
	}

	payload := push.NotifyPayload{
		Title: "Поддержка: " + visitorName,
		Body:  preview,
		URL:   "/",
	}

	go s.pusher.SendToUsers(ctx, workerIDs, payload)
}

// notifyMaxBot уведомляет бота Макс о новом сообщении от клиента.
func (s *Server) notifyMaxBot(
	ctx context.Context,
	conversation store.SupportConversation,
	message store.SupportMessage,
) error {
	if s.cfg.MaxBotURL == "" {
		return nil // Бот не настроен — просто пропускаем
	}

	visitorName := conversation.VisitorName
	if visitorName == "" {
		visitorName = fmt.Sprintf("Посетитель #%d", conversation.ID)
	}

	payload := map[string]any{
		"external_id":  conversation.ExternalID,
		"visitor_name": visitorName,
		"message":      message.Text,
		"conversation_id": conversation.ID,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to encode max bot payload: %w", err)
	}

	url := strings.TrimRight(s.cfg.MaxBotURL, "/") + "/bot/support/notify"

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		url,
		bytes.NewReader(body),
	)
	if err != nil {
		return fmt.Errorf("failed to create max bot request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if s.cfg.MaxBotSecret != "" {
		req.Header.Set("X-Bot-Secret", s.cfg.MaxBotSecret)
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to notify Max bot: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Max bot returned status %s", resp.Status)
	}

	return nil
}
