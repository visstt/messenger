package mail

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"
)

type SMTPConfig struct {
	Host     string
	Port     string
	Secure   bool
	User     string
	Password string
	From     string
}

type Sender interface {
	Send(ctx context.Context, to string, subject string, bodyText string) error
	Enabled() bool
}

type SMTPSender struct {
	cfg SMTPConfig
}

func NewSMTPSender(cfg SMTPConfig) *SMTPSender {
	return &SMTPSender{cfg: cfg}
}

func (s *SMTPSender) Enabled() bool {
	return strings.TrimSpace(s.cfg.Host) != "" &&
		strings.TrimSpace(s.cfg.Port) != "" &&
		strings.TrimSpace(s.cfg.User) != "" &&
		strings.TrimSpace(s.cfg.Password) != "" &&
		strings.TrimSpace(s.cfg.From) != ""
}

func (s *SMTPSender) Send(ctx context.Context, to string, subject string, bodyText string) error {
	if !s.Enabled() {
		return fmt.Errorf("smtp is not configured")
	}
	to = strings.TrimSpace(to)
	if to == "" {
		return fmt.Errorf("recipient is required")
	}

	from := strings.TrimSpace(s.cfg.From)
	if from == "" {
		from = strings.TrimSpace(s.cfg.User)
	}

	msg := []byte(buildMessage(from, to, subject, bodyText))

	if s.cfg.Secure {
		return s.sendImplicitTLS(ctx, from, to, msg)
	}
	return s.sendSTARTTLS(ctx, from, to, msg)
}


// selectAuth выбирает метод авторизации в зависимости от поддерживаемых сервером.
func (s *SMTPSender) selectAuth(client *smtp.Client) smtp.Auth {
	ok, ext := client.Extension("AUTH")
	if !ok {
		return smtp.PlainAuth("", s.cfg.User, s.cfg.Password, s.cfg.Host)
	}
	extUpper := strings.ToUpper(ext)
	if !strings.Contains(extUpper, "PLAIN") && strings.Contains(extUpper, "LOGIN") {
		return LoginAuth(s.cfg.User, s.cfg.Password)
	}
	return smtp.PlainAuth("", s.cfg.User, s.cfg.Password, s.cfg.Host)
}

// sendSTARTTLS — порт 587 (reg.ru): стандартный поток Go без лишних Hello().
func (s *SMTPSender) sendSTARTTLS(ctx context.Context, from, to string, msg []byte) error {
	addr := net.JoinHostPort(s.cfg.Host, s.cfg.Port)
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.cfg.Host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if err := client.Hello(s.cfg.Host); err != nil {
		return fmt.Errorf("smtp hello: %w", err)
	}
	if ok, _ := client.Extension("STARTTLS"); !ok {
		return fmt.Errorf("smtp: STARTTLS not supported by server")
	}
	if err := client.StartTLS(&tls.Config{ServerName: s.cfg.Host}); err != nil {
		return fmt.Errorf("smtp starttls: %w", err)
	}

	auth := s.selectAuth(client)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close data: %w", err)
	}
	return client.Quit()
}

func (s *SMTPSender) sendImplicitTLS(ctx context.Context, from, to string, msg []byte) error {
	addr := net.JoinHostPort(s.cfg.Host, s.cfg.Port)
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	defer conn.Close()

	tlsConn := tls.Client(conn, &tls.Config{ServerName: s.cfg.Host})
	if err := tlsConn.HandshakeContext(ctx); err != nil {
		return fmt.Errorf("smtp tls handshake: %w", err)
	}

	client, err := smtp.NewClient(tlsConn, s.cfg.Host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	auth := s.selectAuth(client)
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close data: %w", err)
	}
	return client.Quit()
}

type loginAuth struct {
	username, password string
}

func LoginAuth(username, password string) smtp.Auth {
	return &loginAuth{username, password}
}

func (a *loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", nil, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		switch string(fromServer) {
		case "Username:", "username:", "USER:", "user:":
			return []byte(a.username), nil
		case "Password:", "password:", "PASS:", "pass:":
			return []byte(a.password), nil
		default:
			lower := strings.ToLower(string(fromServer))
			if strings.Contains(lower, "user") {
				return []byte(a.username), nil
			}
			if strings.Contains(lower, "pass") {
				return []byte(a.password), nil
			}
			return nil, fmt.Errorf("unexpected smtp challenge: %s", string(fromServer))
		}
	}
	return nil, nil
}


func buildMessage(from string, to string, subject string, bodyText string) string {
	subject = strings.TrimSpace(subject)
	if subject == "" {
		subject = "Message"
	}
	bodyText = strings.ReplaceAll(bodyText, "\r\n", "\n")
	bodyText = strings.ReplaceAll(bodyText, "\n", "\r\n")

	fromHeader := from
	if !strings.Contains(from, "<") {
		fromHeader = fmt.Sprintf("Signal <%s>", from)
	}

	headers := []string{
		"From: " + fromHeader,
		"To: " + to,
		"Subject: " + encodeSubject(subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"Message-ID: <" + randomMessageID(from) + ">",
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		"X-Mailer: Signal Messenger",
		"",
	}
	return strings.Join(headers, "\r\n") + bodyText + "\r\n"
}

func randomMessageID(from string) string {
	var b [12]byte
	_, _ = rand.Read(b[:])
	domain := from
	if i := strings.LastIndex(from, "@"); i >= 0 {
		domain = from[i+1:]
	}
	return fmt.Sprintf("%d.%s@%s", time.Now().UnixNano(), hex.EncodeToString(b[:]), domain)
}

func encodeSubject(subject string) string {
	if isASCII(subject) {
		return subject
	}
	return "=?UTF-8?B?" + b64(subject) + "?="
}

func isASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] >= 0x80 {
			return false
		}
	}
	return true
}

func b64(s string) string {
	const table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
	data := []byte(s)
	var out strings.Builder
	out.Grow(((len(data) + 2) / 3) * 4)
	for i := 0; i < len(data); i += 3 {
		var b [3]byte
		n := copy(b[:], data[i:])
		v := uint(b[0])<<16 | uint(b[1])<<8 | uint(b[2])
		out.WriteByte(table[(v>>18)&0x3f])
		out.WriteByte(table[(v>>12)&0x3f])
		if n > 1 {
			out.WriteByte(table[(v>>6)&0x3f])
		} else {
			out.WriteByte('=')
		}
		if n > 2 {
			out.WriteByte(table[v&0x3f])
		} else {
			out.WriteByte('=')
		}
	}
	return out.String()
}
