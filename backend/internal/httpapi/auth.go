package httpapi

import (
	"encoding/json"
	"net/http"

	"messenger/backend/internal/store"
)

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var input store.Credentials
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	input = store.NormalizeRegistration(input)
	if err := store.ValidateRegistration(input); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if conflict, err := s.store.RegistrationConflict(r.Context(), input.Username, input.Email); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check registration")
		return
	} else if conflict == "username" {
		writeError(w, http.StatusBadRequest, "это имя пользователя уже занято")
		return
	} else if conflict == "email" {
		writeError(w, http.StatusBadRequest, "эта почта уже зарегистрирована — попробуйте войти")
		return
	}

	user, err := s.store.CreateUser(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusBadRequest, store.MapCreateUserError(err))
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
