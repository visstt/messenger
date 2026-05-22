package httpapi

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"

	"messenger/backend/internal/mail"
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

	code, err := store.GenerateNumericCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create verification code")
		return
	}
	if err := s.store.CreateEmailToken(r.Context(), user.ID, store.TokenPurposeVerifyEmail, code, store.VerifyCodeTTL()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save verification code")
		return
	}

	if err := s.sendVerificationEmail(r, user.Email, user.Name, code); err != nil {
		log.Printf("verification email failed for user %d: %v", user.ID, err)
		writeError(w, http.StatusServiceUnavailable, "failed to send verification email")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"needsVerification": true,
		"email":             user.Email,
	})
}

func (s *Server) handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := s.store.GetUserByEmail(r.Context(), input.Email)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid verification code")
		return
	}
	if user.EmailVerified {
		s.setSession(w, user.ID)
		writeJSON(w, http.StatusOK, map[string]any{"user": user})
		return
	}

	code := strings.TrimSpace(input.Code)
	if len(code) != 6 {
		writeError(w, http.StatusBadRequest, "invalid verification code")
		return
	}
	if err := s.store.ConsumeEmailToken(r.Context(), user.ID, store.TokenPurposeVerifyEmail, code); err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired verification code")
		return
	}
	if err := s.store.MarkEmailVerified(r.Context(), user.ID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify email")
		return
	}

	user, err = s.store.GetUserByID(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load user")
		return
	}
	s.setSession(w, user.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) handleResendVerification(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := s.store.GetUserByEmail(r.Context(), input.Email)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}
	if user.EmailVerified {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	code, err := store.GenerateNumericCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create verification code")
		return
	}
	if err := s.store.CreateEmailToken(r.Context(), user.ID, store.TokenPurposeVerifyEmail, code, store.VerifyCodeTTL()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save verification code")
		return
	}
	if err := s.sendVerificationEmail(r, user.Email, user.Name, code); err != nil {
		log.Printf("resend verification email failed for user %d: %v", user.ID, err)
		writeError(w, http.StatusServiceUnavailable, "failed to send verification email")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleForgotPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}

	user, err := s.store.GetUserByEmail(r.Context(), input.Email)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
		return
	}

	token, err := store.GenerateResetToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create reset token")
		return
	}
	if err := s.store.CreateEmailToken(r.Context(), user.ID, store.TokenPurposePasswordReset, token, store.PasswordResetTokenTTL()); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save reset token")
		return
	}

	resetURL := strings.TrimRight(s.cfg.AppOrigin, "/") + "/?reset=" + token
	if err := s.sendPasswordResetEmail(r, user.Email, user.Name, resetURL); err != nil {
		log.Printf("password reset email failed for user %d: %v", user.ID, err)
		writeError(w, http.StatusServiceUnavailable, "failed to send reset email")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (s *Server) handleResetPassword(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request")
		return
	}
	if err := store.ValidatePassword(input.Password); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	userID, err := s.store.ConsumeEmailTokenByValue(r.Context(), store.TokenPurposePasswordReset, strings.TrimSpace(input.Token))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid or expired reset link")
		return
	}
	if err := s.store.UpdateUserPassword(r.Context(), userID, input.Password); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update password")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
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
		if errors.Is(err, store.ErrEmailNotVerified) {
			email := ""
			if pending, lookupErr := s.store.GetUserByIdentifier(r.Context(), input.Identifier); lookupErr == nil {
				email = pending.Email
			}
			writeJSON(w, http.StatusForbidden, map[string]any{
				"error":             "email not verified",
				"needsVerification": true,
				"email":             email,
			})
			return
		}
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	s.setSession(w, user.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Server) sendVerificationEmail(r *http.Request, email, name, code string) error {
	if !s.mailer.Enabled() {
		return errors.New("mailer not configured")
	}
	ctx, cancel := mail.WithTimeout(r.Context())
	defer cancel()
	return s.mailer.SendVerificationCode(ctx, email, name, code)
}

func (s *Server) sendPasswordResetEmail(r *http.Request, email, name, resetURL string) error {
	if !s.mailer.Enabled() {
		return errors.New("mailer not configured")
	}
	ctx, cancel := mail.WithTimeout(r.Context())
	defer cancel()
	return s.mailer.SendPasswordReset(ctx, email, name, resetURL)
}
