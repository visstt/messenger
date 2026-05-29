package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"messenger/backend/internal/mail"
)

func main() {
	cfg := mail.SMTPConfig{
		Host:     env("SMTP_HOST"),
		Port:     env("SMTP_PORT", "587"),
		Secure:   strings.EqualFold(env("SMTP_SECURE"), "true"),
		User:     env("SMTP_USER"),
		Password: env("SMTP_PASSWORD"),
		From:     env("SMTP_FROM"),
	}
	to := env("TEST_TO", "egorskomorohov020606@gmail.com")

	sender := mail.NewSMTPSender(cfg)
	fmt.Printf("SMTP enabled: %v\n", sender.Enabled())
	fmt.Printf("Host: %s:%s secure=%v from=%s to=%s\n", cfg.Host, cfg.Port, cfg.Secure, cfg.From, to)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	err := sender.Send(ctx, to, "Signal SMTP test", "Test message from smtptest at "+time.Now().Format(time.RFC3339))
	if err != nil {
		fmt.Fprintf(os.Stderr, "SEND FAILED: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("SEND OK — check inbox and spam")
}

func env(key string, fallback ...string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	if len(fallback) > 0 {
		return fallback[0]
	}
	return ""
}
