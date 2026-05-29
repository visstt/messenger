package httpapi

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
)

func (s *Server) exposeVerificationCodes() bool {
	if strings.EqualFold(os.Getenv("SMTP_LOG_CODES"), "true") {
		return true
	}
	origin := strings.ToLower(s.cfg.AppOrigin)
	return strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1")
}

func (s *Server) sendVerificationCode(ctx context.Context, email, code string) error {
	log.Printf("[email-verify] verification code for %s: %s", email, code)
	if !s.mailer.Enabled() {
		return fmt.Errorf("smtp is not configured")
	}
	subject := "Подтверждение почты — Signal"
	body := fmt.Sprintf(
		"Здравствуйте!\n\nВаш код подтверждения: %s\n\nКод действует 15 минут.\n\nЕсли вы не регистрировались в Signal — проигнорируйте это письмо.",
		code,
	)
	if err := s.mailer.Send(ctx, email, subject, body); err != nil {
		return err
	}
	log.Printf("[email-verify] email accepted by SMTP server for %s (check spam if Gmail)", email)
	return nil
}
