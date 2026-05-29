package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrTooManyRequests = errors.New("too many requests")

const (
	emailCodeTTL       = 15 * time.Minute
	emailResendMinWait = 30 * time.Second
)

func (s *Store) HasPendingEmailVerification(ctx context.Context, userID int64) (bool, error) {
	var exists bool
	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM email_verification_codes WHERE user_id = $1)
	`, userID).Scan(&exists)
	return exists, err
}

func (s *Store) MarkEmailVerified(ctx context.Context, userID int64) error {
	_, err := s.db.Exec(ctx, `
		UPDATE users SET email_verified_at = NOW() WHERE id = $1 AND email_verified_at IS NULL
	`, userID)
	if err != nil {
		return err
	}
	_, _ = s.db.Exec(ctx, `DELETE FROM email_verification_codes WHERE user_id = $1`, userID)
	return nil
}

func (s *Store) VerifyLegacyUserIfNeeded(ctx context.Context, userID int64) error {
	pending, err := s.HasPendingEmailVerification(ctx, userID)
	if err != nil {
		return err
	}
	if pending {
		return nil
	}
	_, err = s.db.Exec(ctx, `
		UPDATE users
		SET email_verified_at = COALESCE(email_verified_at, NOW())
		WHERE id = $1 AND email_verified_at IS NULL
	`, userID)
	return err
}

func (s *Store) IsEmailVerified(ctx context.Context, identifier string) (bool, error) {
	var verifiedAt *time.Time
	err := s.db.QueryRow(ctx, `
		SELECT email_verified_at
		FROM users
		WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
	`, strings.TrimSpace(identifier)).Scan(&verifiedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, ErrNotFound
		}
		return false, err
	}
	return verifiedAt != nil, nil
}

func (s *Store) CreateEmailVerificationCode(ctx context.Context, userID int64, email string) (string, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if email == "" {
		return "", fmt.Errorf("email is required")
	}

	var lastCreated *time.Time
	_ = s.db.QueryRow(ctx, `
		SELECT created_at
		FROM email_verification_codes
		WHERE user_id = $1
	`, userID).Scan(&lastCreated)
	if lastCreated != nil && time.Since(*lastCreated) < emailResendMinWait {
		return "", ErrTooManyRequests
	}

	code, err := generate6Digits()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().Add(emailCodeTTL)
	hash := hashEmailCode(email, code)

	_, err = s.db.Exec(ctx, `
		INSERT INTO email_verification_codes (user_id, email, code_hash, expires_at)
		VALUES ($1, LOWER($2), $3, $4)
		ON CONFLICT (user_id) DO UPDATE
		SET email = LOWER(EXCLUDED.email),
		    code_hash = EXCLUDED.code_hash,
		    expires_at = EXCLUDED.expires_at,
		    created_at = NOW()
	`, userID, email, hash, expiresAt)
	if err != nil {
		return "", err
	}
	return code, nil
}

func (s *Store) ConfirmEmailVerificationCode(ctx context.Context, email string, code string) (User, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	code = strings.TrimSpace(code)
	if email == "" || code == "" {
		return User{}, fmt.Errorf("email and code are required")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(ctx)

	var userID int64
	var verifiedAt *time.Time
	if err := tx.QueryRow(ctx, `
		SELECT id, email_verified_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`, email).Scan(&userID, &verifiedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	if verifiedAt != nil {
		user, err := s.GetUserByID(ctx, userID)
		if err != nil {
			return User{}, err
		}
		_ = tx.Commit(ctx)
		return user, nil
	}

	var codeHash string
	var expiresAt time.Time
	if err := tx.QueryRow(ctx, `
		SELECT code_hash, expires_at
		FROM email_verification_codes
		WHERE user_id = $1 AND LOWER(email) = LOWER($2)
	`, userID, email).Scan(&codeHash, &expiresAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrForbidden
		}
		return User{}, err
	}
	if time.Now().After(expiresAt) {
		return User{}, ErrForbidden
	}

	if hashEmailCode(email, code) != codeHash {
		return User{}, ErrForbidden
	}

	if _, err := tx.Exec(ctx, `UPDATE users SET email_verified_at = NOW() WHERE id = $1`, userID); err != nil {
		return User{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM email_verification_codes WHERE user_id = $1`, userID); err != nil {
		return User{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}
	return s.GetUserByID(ctx, userID)
}

func generate6Digits() (string, error) {
	var b [4]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	n := int(b[0])<<24 | int(b[1])<<16 | int(b[2])<<8 | int(b[3])
	if n < 0 {
		n = -n
	}
	code := n % 1000000
	return fmt.Sprintf("%06d", code), nil
}

func hashEmailCode(email string, code string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(email)) + ":" + strings.TrimSpace(code)))
	return hex.EncodeToString(sum[:])
}

