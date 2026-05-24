package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"messenger/backend/internal/auth"
	"messenger/backend/internal/store"
)

func (s *Server) setAdminSession(w http.ResponseWriter, adminID int64) {
	token, _ := auth.CreateAdminToken(s.cfg.JWTSecret, adminID)
	http.SetCookie(w, &http.Cookie{
		Name:     "messenger_admin_session",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   7 * 24 * 60 * 60,
	})
}

func (s *Server) handleAdminLogin(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	admin, err := s.store.AuthenticateAdmin(r.Context(), input.Username, input.Password)
	if err != nil {
		time.Sleep(400 * time.Millisecond)
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	s.setAdminSession(w, admin.ID)
	writeJSON(w, http.StatusOK, map[string]any{"admin": admin})
}

func (s *Server) handleAdminLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "messenger_admin_session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleAdminMe(w http.ResponseWriter, r *http.Request) {
	admin, err := s.store.GetAdminByID(r.Context(), currentAdminID(r.Context()))
	if err != nil {
		if err == store.ErrNotFound {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load admin")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"admin": admin})
}
