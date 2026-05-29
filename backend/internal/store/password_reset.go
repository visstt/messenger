package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"messenger/backend/internal/auth"

	"github.com/jackc/pgx/v5"
)

const passwordResetTTL = 15 * time.Minute

func (s *Store) CreatePasswordResetCode(ctx context.Context, email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return "", fmt.Errorf("email is required")
	}

	if _, err := s.GetUserByIdentifier(ctx, email); err != nil {
		if errors.Is(err, ErrNotFound) {
			// Не раскрываем, зарегистрирован ли email
			time.Sleep(250 * time.Millisecond)
			return "", nil
		}
		return "", err
	}

	var lastCreated *time.Time
	_ = s.db.QueryRow(ctx, `
		SELECT created_at FROM password_reset_codes WHERE LOWER(email) = LOWER($1)
	`, email).Scan(&lastCreated)
	if lastCreated != nil && time.Since(*lastCreated) < emailResendMinWait {
		return "", ErrTooManyRequests
	}

	code, err := generate6Digits()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(passwordResetTTL)
	hash := hashEmailCode(email, code)

	_, err = s.db.Exec(ctx, `
		INSERT INTO password_reset_codes (email, code_hash, expires_at)
		VALUES (LOWER($1), $2, $3)
		ON CONFLICT (email) DO UPDATE
		SET code_hash = EXCLUDED.code_hash,
		    expires_at = EXCLUDED.expires_at,
		    created_at = NOW()
	`, email, hash, expiresAt)
	if err != nil {
		return "", err
	}
	return code, nil
}

func (s *Store) ConfirmPasswordReset(ctx context.Context, email, code, newPassword string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	code = strings.TrimSpace(code)
	newPassword = strings.TrimSpace(newPassword)
	if email == "" || code == "" {
		return fmt.Errorf("email and code are required")
	}
	if len(newPassword) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	var codeHash string
	var expiresAt time.Time
	err := s.db.QueryRow(ctx, `
		SELECT code_hash, expires_at FROM password_reset_codes WHERE LOWER(email) = LOWER($1)
	`, email).Scan(&codeHash, &expiresAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}
	if time.Now().After(expiresAt) {
		return ErrForbidden
	}
	if hashEmailCode(email, code) != codeHash {
		return ErrForbidden
	}

	user, err := s.GetUserByIdentifier(ctx, email)
	if err != nil {
		return err
	}

	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, user.ID, hash); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM password_reset_codes WHERE LOWER(email) = LOWER($1)`, email); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
