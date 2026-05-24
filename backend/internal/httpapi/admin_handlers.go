package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"messenger/backend/internal/store"

	"github.com/go-chi/chi/v5"
)

func (s *Server) handleAdminListUsers(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("query")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	users, err := s.store.AdminListUsers(r.Context(), query, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": users})
}

func (s *Server) handleAdminGetUser(w http.ResponseWriter, r *http.Request) {
	userID := parseInt64Param(chi.URLParam(r, "userID"))
	user, err := s.store.AdminGetUser(r.Context(), userID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleAdminUpdateUser(w http.ResponseWriter, r *http.Request) {
	userID := parseInt64Param(chi.URLParam(r, "userID"))
	var input store.AdminUserUpdate
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := s.store.AdminUpdateUser(r.Context(), userID, input)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleAdminUpdateUserPassword(w http.ResponseWriter, r *http.Request) {
	userID := parseInt64Param(chi.URLParam(r, "userID"))
	var input struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	if err := s.store.AdminUpdateUserPassword(r.Context(), userID, input.Password); err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleAdminListUserChats(w http.ResponseWriter, r *http.Request) {
	userID := parseInt64Param(chi.URLParam(r, "userID"))
	chats, err := s.store.AdminListUserChats(r.Context(), userID)
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to list chats")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": chats})
}

func (s *Server) handleAdminListChatMessages(w http.ResponseWriter, r *http.Request) {
	chatID := parseInt64Param(chi.URLParam(r, "chatID"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	messages, err := s.store.AdminListChatMessages(r.Context(), chatID, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list messages")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": messages})
}
