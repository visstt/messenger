package httpapi

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

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

	if !s.mailer.Enabled() {
		if err := s.store.MarkEmailVerified(r.Context(), user.ID); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to verify email")
			return
		}
		s.setSession(w, user.ID)
		writeJSON(w, http.StatusCreated, map[string]any{"user": user})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"pendingVerification": true,
		"email":               user.Email,
	})
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
	if err := s.store.VerifyLegacyUserIfNeeded(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check email verification")
		return
	}
	verified, err := s.store.IsEmailVerified(r.Context(), input.Identifier)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check email verification")
		return
	}
	if !verified {
		time.Sleep(250 * time.Millisecond)
		writeError(w, http.StatusForbidden, "email not verified")
		return
	}
	s.setSession(w, user.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleVerifyConfirm(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Code = strings.TrimSpace(input.Code)
	if input.Email == "" || input.Code == "" {
		writeError(w, http.StatusBadRequest, "email and code are required")
		return
	}

	user, err := s.store.ConfirmEmailVerificationCode(r.Context(), input.Email, input.Code)
	if err != nil {
		if err == store.ErrForbidden || err == store.ErrNotFound {
			writeError(w, http.StatusBadRequest, "invalid code")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to verify email")
		return
	}
	s.setSession(w, user.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleVerifyResend(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	email := strings.TrimSpace(strings.ToLower(input.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	user, err := s.store.GetUserByIdentifier(r.Context(), email)
	if err != nil {
		time.Sleep(250 * time.Millisecond)
		writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}

	code, err := s.store.CreateEmailVerificationCode(r.Context(), user.ID, user.Email)
	if err != nil {
		if err == store.ErrTooManyRequests {
			writeError(w, http.StatusTooManyRequests, "try again later")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create verification code")
		return
	}

	emailFailed := false
	if err := s.sendVerificationCode(r.Context(), user.Email, code); err != nil {
		emailFailed = true
		log.Printf("verification email to %s failed: %v", user.Email, err)
	}

	resp := map[string]any{
		"ok":                  true,
		"emailDeliveryFailed": emailFailed,
	}
	if s.exposeVerificationCodes() {
		resp["devCode"] = code
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	email := strings.TrimSpace(strings.ToLower(input.Email))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}

	code, err := s.store.CreatePasswordResetCode(r.Context(), email)
	if err != nil {
		if err == store.ErrTooManyRequests {
			writeError(w, http.StatusTooManyRequests, "try again later")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to create reset code")
		return
	}
	if code != "" {
		if err := s.mailer.Send(r.Context(), email, "Сброс пароля", fmt.Sprintf("Код для сброса пароля: %s", code)); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to send reset email")
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email       string `json:"email"`
		Code        string `json:"code"`
		NewPassword string `json:"newPassword"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Code = strings.TrimSpace(input.Code)
	input.NewPassword = strings.TrimSpace(input.NewPassword)
	if input.Email == "" || input.Code == "" || input.NewPassword == "" {
		writeError(w, http.StatusBadRequest, "email, code and new password are required")
		return
	}

	if err := s.store.ConfirmPasswordReset(r.Context(), input.Email, input.Code, input.NewPassword); err != nil {
		if err == store.ErrForbidden {
			writeError(w, http.StatusBadRequest, "invalid code")
			return
		}
		if err.Error() == "password must be at least 8 characters" {
			writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to reset password")
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
