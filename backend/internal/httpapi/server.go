package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"messenger/backend/internal/auth"
	"messenger/backend/internal/config"
	"messenger/backend/internal/realtime"
	"messenger/backend/internal/store"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/gorilla/websocket"
)

type Server struct {
	cfg      config.Config
	store    *store.Store
	hub      *realtime.Hub
	upgrader websocket.Upgrader
}

type contextKey string

const userIDKey contextKey = "userID"

func NewServer(cfg config.Config, st *store.Store, hub *realtime.Hub) http.Handler {
	s := &Server{
		cfg:   cfg,
		store: st,
		hub:   hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}

	r := chi.NewRouter()
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.AppOrigin, "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(cfg.UploadDir))))

	r.Post("/api/auth/register", s.handleRegister)
	r.Post("/api/auth/login", s.handleLogin)
	r.Post("/api/auth/logout", s.handleLogout)

	r.Group(func(protected chi.Router) {
		protected.Use(s.authMiddleware)

		protected.Get("/api/auth/me", s.handleMe)
		protected.Get("/api/users/search", s.handleUserSearch)
		protected.Patch("/api/users/me", s.handleUpdateProfile)
		protected.Put("/api/users/me/keys", s.handleUpdateKeys)
		protected.Post("/api/users/me/avatar", s.handleUploadAvatar)
		protected.Get("/api/chats", s.handleListChats)
		protected.Post("/api/chats/private", s.handleCreatePrivateChat)
		protected.Post("/api/chats/group", s.handleCreateGroupChat)
		protected.Post("/api/chats/{chatID}/e2ee/enable", s.handleEnableChatE2EE)
		protected.Get("/api/chats/{chatID}/messages", s.handleListMessages)
		protected.Post("/api/chats/{chatID}/messages/text", s.handleSendTextMessage)
		protected.Post("/api/chats/{chatID}/messages/image", s.handleSendImageMessage)
		protected.Post("/api/chats/{chatID}/messages/video", s.handleSendVideoMessage)
		protected.Post("/api/chats/{chatID}/messages/file", s.handleSendGenericFileMessage)
		protected.Post("/api/chats/{chatID}/messages/voice", s.handleSendVoiceMessage)
		protected.Post("/api/chats/{chatID}/read", s.handleMarkRead)
		protected.Post("/api/chats/{chatID}/typing", s.handleTyping)
		protected.Patch("/api/messages/{messageID}", s.handleEditMessage)
		protected.Delete("/api/messages/{messageID}", s.handleDeleteMessage)
		protected.Get("/ws", s.handleWebSocket)
	})

	return r
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var input store.Credentials
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := store.ValidateRegistration(input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	user, err := s.store.CreateUser(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "username or email already exists")
		return
	}
	s.setSession(w, user.ID)
	writeJSON(w, http.StatusCreated, map[string]any{"user": user})
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Identifier string `json:"identifier"`
		Password   string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := s.store.AuthenticateUser(r.Context(), input.Identifier, input.Password)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	s.setSession(w, user.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "messenger_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	user, err := s.store.GetUserByID(r.Context(), currentUserID(r.Context()))
	if err != nil {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleUserSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	users, err := s.store.SearchUsers(r.Context(), currentUserID(r.Context()), query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to search users")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": users})
}

func (s *Server) handleUpdateProfile(w http.ResponseWriter, r *http.Request) {
	var input store.ProfileUpdate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	user, err := s.store.UpdateProfile(r.Context(), currentUserID(r.Context()), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to update profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleUpdateKeys(w http.ResponseWriter, r *http.Request) {
	var input struct {
		PublicKey string `json:"publicKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if strings.TrimSpace(input.PublicKey) == "" {
		writeError(w, http.StatusBadRequest, "public key is required")
		return
	}
	user, err := s.store.UpdatePublicKey(r.Context(), currentUserID(r.Context()), input.PublicKey)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to update public key")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleUploadAvatar(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid upload")
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}
	defer file.Close()

	extension := filepath.Ext(header.Filename)
	filename := fmt.Sprintf("avatar-%d-%d%s", time.Now().UnixNano(), currentUserID(r.Context()), extension)
	targetPath := filepath.Join(s.cfg.UploadDir, filename)

	dst, err := os.Create(targetPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save avatar")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save avatar")
		return
	}

	user, err := s.store.UpdateAvatar(r.Context(), currentUserID(r.Context()), "/uploads/"+filename)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to update avatar")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleListChats(w http.ResponseWriter, r *http.Request) {
	chats, err := s.store.ListChats(r.Context(), currentUserID(r.Context()))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load chats")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": chats})
}

func (s *Server) handleCreatePrivateChat(w http.ResponseWriter, r *http.Request) {
	var input struct {
		UserID int64 `json:"userId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	chat, err := s.store.CreateOrGetPrivateChat(r.Context(), currentUserID(r.Context()), input.UserID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to create chat")
		return
	}
	s.pushChatCreatedEvent(chat, currentUserID(r.Context()))
	writeJSON(w, http.StatusCreated, map[string]any{"chat": chat})
}

func (s *Server) handleCreateGroupChat(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title   string  `json:"title"`
		UserIDs []int64 `json:"userIds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	chat, err := s.store.CreateGroupChat(r.Context(), currentUserID(r.Context()), input.Title, input.UserIDs)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to create group chat")
		return
	}
	s.pushChatCreatedEvent(chat, currentUserID(r.Context()))
	writeJSON(w, http.StatusCreated, map[string]any{"chat": chat})
}

func (s *Server) handleEnableChatE2EE(w http.ResponseWriter, r *http.Request) {
	chatID := parseInt64Param(chi.URLParam(r, "chatID"))
	chat, msg, recipientIDs, changed, err := s.store.EnableChatE2EE(r.Context(), currentUserID(r.Context()), chatID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to enable E2EE")
		return
	}

	if changed {
		s.pushChatE2EEEvent(chat, recipientIDs, currentUserID(r.Context()))
		s.pushMessageEvents(msg, recipientIDs, currentUserID(r.Context()))
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"chat":    chat,
		"changed": changed,
	})
}

func (s *Server) handleListMessages(w http.ResponseWriter, r *http.Request) {
	chatID, err := strconv.ParseInt(chi.URLParam(r, "chatID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid chat id")
		return
	}
	chat, messages, err := s.store.ListMessages(r.Context(), currentUserID(r.Context()), chatID, 80)
	if err != nil {
		writeError(w, http.StatusNotFound, "chat not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"chat": chat, "items": messages})
}

func (s *Server) handleSendTextMessage(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Text             string `json:"text"`
		EncryptedPayload string `json:"encryptedPayload"`
		EncryptionMeta   string `json:"encryptionMeta"`
		ReplyToMessageID *int64 `json:"replyToMessageId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	msg, recipientIDs, err := s.store.CreateMessage(r.Context(), store.NewMessage{
		ChatID:           parseInt64Param(chi.URLParam(r, "chatID")),
		SenderID:         currentUserID(r.Context()),
		Kind:             "text",
		Text:             strings.TrimSpace(input.Text),
		EncryptedPayload: strings.TrimSpace(input.EncryptedPayload),
		EncryptionMeta:   strings.TrimSpace(input.EncryptionMeta),
		ReplyToMessageID: input.ReplyToMessageID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to send message")
		return
	}

	s.pushMessageEvents(msg, recipientIDs, currentUserID(r.Context()))
	writeJSON(w, http.StatusCreated, map[string]any{"message": msg})
}

func (s *Server) handleSendImageMessage(w http.ResponseWriter, r *http.Request) {
	s.handleFileMessage(w, r, "image")
}

func (s *Server) handleSendVideoMessage(w http.ResponseWriter, r *http.Request) {
	s.handleFileMessage(w, r, "video")
}

func (s *Server) handleSendGenericFileMessage(w http.ResponseWriter, r *http.Request) {
	s.handleFileMessage(w, r, "file")
}

func (s *Server) handleSendVoiceMessage(w http.ResponseWriter, r *http.Request) {
	s.handleFileMessage(w, r, "voice")
}

func (s *Server) handleFileMessage(w http.ResponseWriter, r *http.Request, kind string) {
	chatID := parseInt64Param(chi.URLParam(r, "chatID"))
	if err := r.ParseMultipartForm(100 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid upload")
		return
	}
	files := r.MultipartForm.File["file"]
	if len(files) == 0 {
		writeError(w, http.StatusBadRequest, "file is required")
		return
	}

	duration, _ := strconv.Atoi(r.FormValue("durationSec"))
	caption := strings.TrimSpace(r.FormValue("text"))
	encryptedPayload := strings.TrimSpace(r.FormValue("encryptedPayload"))
	encryptionMeta := strings.TrimSpace(r.FormValue("encryptionMeta"))
	var replyTo *int64
	if value := r.FormValue("replyToMessageId"); value != "" {
		id, err := strconv.ParseInt(value, 10, 64)
		if err == nil {
			replyTo = &id
		}
	}

	var savedURLs []string
	var savedNames []string

	for _, header := range files {
		file, err := header.Open()
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to open file")
			return
		}

		extension := filepath.Ext(header.Filename)
		filename := fmt.Sprintf("%d-%d%s", time.Now().UnixNano(), currentUserID(r.Context()), extension)
		targetPath := filepath.Join(s.cfg.UploadDir, filename)

		dst, err := os.Create(targetPath)
		if err != nil {
			file.Close()
			writeError(w, http.StatusInternalServerError, "failed to save file")
			return
		}

		if _, err := io.Copy(dst, file); err != nil {
			dst.Close()
			file.Close()
			writeError(w, http.StatusInternalServerError, "failed to save file")
			return
		}

		dst.Close()
		file.Close()

		savedURLs = append(savedURLs, "/uploads/"+filename)
		savedNames = append(savedNames, header.Filename)
	}

	fileURL := savedURLs[0]
	fileName := savedNames[0]
	if kind == "image" && len(savedURLs) > 1 {
		urlsJSON, _ := json.Marshal(savedURLs)
		namesJSON, _ := json.Marshal(savedNames)
		fileURL = string(urlsJSON)
		fileName = string(namesJSON)
	}

	msg, recipientIDs, err := s.store.CreateMessage(r.Context(), store.NewMessage{
		ChatID:           chatID,
		SenderID:         currentUserID(r.Context()),
		Kind:             kind,
		Text:             caption,
		FileURL:          fileURL,
		FileName:         fileName,
		DurationSec:      duration,
		EncryptedPayload: encryptedPayload,
		EncryptionMeta:   encryptionMeta,
		ReplyToMessageID: replyTo,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to send message")
		return
	}

	s.pushMessageEvents(msg, recipientIDs, currentUserID(r.Context()))
	writeJSON(w, http.StatusCreated, map[string]any{"message": msg})
}

func (s *Server) handleMarkRead(w http.ResponseWriter, r *http.Request) {
	chatID := parseInt64Param(chi.URLParam(r, "chatID"))
	recipientIDs, err := s.store.MarkChatRead(r.Context(), currentUserID(r.Context()), chatID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to mark chat as read")
		return
	}
	for _, recipientID := range recipientIDs {
		s.hub.BroadcastToUser(recipientID, realtime.Event{
			Type: "chat:read",
			Data: map[string]any{"chatId": chatID, "readerId": currentUserID(r.Context())},
		})
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleTyping(w http.ResponseWriter, r *http.Request) {
	chatID := parseInt64Param(chi.URLParam(r, "chatID"))
	var input struct {
		Typing bool `json:"typing"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	recipientIDs, err := s.store.GetRecipientIDs(r.Context(), currentUserID(r.Context()), chatID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to send typing event")
		return
	}
	for _, recipientID := range recipientIDs {
		s.hub.BroadcastToUser(recipientID, realtime.Event{
			Type: "chat:typing",
			Data: map[string]any{
				"chatId":   chatID,
				"userId":   currentUserID(r.Context()),
				"isTyping": input.Typing,
			},
		})
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleEditMessage(w http.ResponseWriter, r *http.Request) {
	messageID := parseInt64Param(chi.URLParam(r, "messageID"))
	var input struct {
		Text             string `json:"text"`
		EncryptedPayload string `json:"encryptedPayload"`
		EncryptionMeta   string `json:"encryptionMeta"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	msg, recipientIDs, err := s.store.EditMessage(
		r.Context(),
		currentUserID(r.Context()),
		messageID,
		input.Text,
		input.EncryptedPayload,
		input.EncryptionMeta,
	)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to edit message")
		return
	}
	s.pushMessageEvents(msg, recipientIDs, currentUserID(r.Context()))
	writeJSON(w, http.StatusOK, map[string]any{"message": msg})
}

func (s *Server) handleDeleteMessage(w http.ResponseWriter, r *http.Request) {
	messageID := parseInt64Param(chi.URLParam(r, "messageID"))
	msg, recipientIDs, err := s.store.DeleteMessage(r.Context(), currentUserID(r.Context()), messageID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to delete message")
		return
	}
	s.pushMessageEvents(msg, recipientIDs, currentUserID(r.Context()))
	writeJSON(w, http.StatusOK, map[string]any{"message": msg})
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	userID := currentUserID(r.Context())
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	s.hub.Register(userID, conn)
	defer s.hub.Unregister(userID, conn)

	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			return
		}
	}
}

func (s *Server) authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("messenger_session")
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		userID, err := auth.ParseToken(s.cfg.JWTSecret, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDKey, userID)))
	})
}

func (s *Server) setSession(w http.ResponseWriter, userID int64) {
	token, _ := auth.CreateToken(s.cfg.JWTSecret, userID)
	http.SetCookie(w, &http.Cookie{
		Name:     "messenger_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 60 * 60,
	})
}

func (s *Server) pushMessageEvents(msg store.Message, recipientIDs []int64, senderID int64) {
	event := realtime.Event{
		Type: "message:upsert",
		Data: map[string]any{
			"chatId":  msg.ChatID,
			"message": msg,
		},
	}
	for _, recipientID := range recipientIDs {
		s.hub.BroadcastToUser(recipientID, event)
	}
	s.hub.BroadcastToUser(senderID, event)
}

func (s *Server) pushChatCreatedEvent(chat store.ChatDetails, creatorID int64) {
	event := realtime.Event{
		Type: "chat:created",
		Data: map[string]any{
			"chatId": chat.ID,
			"chat":   chat,
		},
	}
	for _, participant := range chat.Participants {
		if participant.ID != creatorID {
			s.hub.BroadcastToUser(participant.ID, event)
		}
	}
}

func (s *Server) pushChatE2EEEvent(chat store.ChatDetails, recipientIDs []int64, actorID int64) {
	event := realtime.Event{
		Type: "chat:e2ee",
		Data: map[string]any{
			"chatId": chat.ID,
			"chat":   chat,
		},
	}
	for _, recipientID := range recipientIDs {
		s.hub.BroadcastToUser(recipientID, event)
	}
	s.hub.BroadcastToUser(actorID, event)
}

func currentUserID(ctx context.Context) int64 {
	value, _ := ctx.Value(userIDKey).(int64)
	return value
}

func parseInt64Param(value string) int64 {
	id, _ := strconv.ParseInt(value, 10, 64)
	return id
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func _isStoreError(err error, target error) bool {
	return errors.Is(err, target)
}
