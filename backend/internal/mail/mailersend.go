package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const apiURL = "https://api.mailersend.com/v1/email"

type Client struct {
	apiKey    string
	fromEmail string
	fromName  string
	enabled   bool
}

func NewClient(apiKey, fromEmail, fromName string) *Client {
	apiKey = strings.TrimSpace(apiKey)
	fromEmail = strings.TrimSpace(fromEmail)
	return &Client{
		apiKey:    apiKey,
		fromEmail: fromEmail,
		fromName:  strings.TrimSpace(fromName),
		enabled:   apiKey != "" && fromEmail != "",
	}
}

func (c *Client) Enabled() bool {
	return c.enabled
}

type recipient struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type fromAddr struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type emailPayload struct {
	From        fromAddr    `json:"from"`
	To          []recipient `json:"to"`
	Subject     string      `json:"subject"`
	Text        string      `json:"text"`
	HTML        string      `json:"html"`
}

func (c *Client) send(ctx context.Context, toEmail, toName, subject, text, html string) error {
	if !c.enabled {
		return fmt.Errorf("email service is not configured")
	}

	body, err := json.Marshal(emailPayload{
		From: fromAddr{Email: c.fromEmail, Name: c.fromName},
		To:   []recipient{{Email: strings.TrimSpace(toEmail), Name: strings.TrimSpace(toName)}},
		Subject: subject,
		Text:    text,
		HTML:    html,
	})
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("mailersend returned status %d", resp.StatusCode)
	}
	return nil
}

func (c *Client) SendVerificationCode(ctx context.Context, toEmail, toName, code string) error {
	subject := "Подтверждение почты — Signal"
	text := fmt.Sprintf("Здравствуйте%s!\n\nВаш код подтверждения: %s\n\nКод действует 30 минут.", greeting(toName), code)
	html := fmt.Sprintf(
		`<p>Здравствуйте%s!</p><p>Ваш код подтверждения:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">%s</p><p>Код действует 30 минут.</p>`,
		greetingHTML(toName),
		code,
	)
	return c.send(ctx, toEmail, toName, subject, text, html)
}

func (c *Client) SendPasswordReset(ctx context.Context, toEmail, toName, resetURL string) error {
	subject := "Восстановление пароля — Signal"
	text := fmt.Sprintf("Здравствуйте%s!\n\nЧтобы сбросить пароль, перейдите по ссылке:\n%s\n\nСсылка действует 1 час. Если вы не запрашивали сброс, проигнорируйте это письмо.", greeting(toName), resetURL)
	html := fmt.Sprintf(
		`<p>Здравствуйте%s!</p><p>Чтобы сбросить пароль, нажмите кнопку:</p><p><a href="%s" style="display:inline-block;padding:12px 20px;background:#2AABEE;color:#fff;text-decoration:none;border-radius:8px">Сбросить пароль</a></p><p>Или скопируйте ссылку: <a href="%s">%s</a></p><p>Ссылка действует 1 час.</p>`,
		greetingHTML(toName),
		resetURL,
		resetURL,
		resetURL,
	)
	return c.send(ctx, toEmail, toName, subject, text, html)
}

func greeting(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	return ", " + name
}

func greetingHTML(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	return ", " + name
}

func WithTimeout(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, 15*time.Second)
}
