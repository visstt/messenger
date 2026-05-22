package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"messenger/backend/internal/auth"

	"github.com/jackc/pgx/v5"
)

const (
	TokenPurposeVerifyEmail   = "verify_email"
	TokenPurposePasswordReset = "password_reset"
)

func VerifyCodeTTL() time.Duration { return 30 * time.Minute }

func PasswordResetTokenTTL() time.Duration { return time.Hour }

var ErrEmailNotVerified = errors.New("email not verified")
var ErrInvalidToken = errors.New("invalid or expired token")

func hashToken(value string) string {
	sum := sha256.Sum256([]byte(strings.TrimSpace(value)))
	return hex.EncodeToString(sum[:])
}

func GenerateNumericCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func GenerateResetToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

func (s *Store) GetUserByEmail(ctx context.Context, email string) (User, error) {
	var user User
	err := s.db.QueryRow(ctx, `
		SELECT id, name, username, email, phone, bio, avatar_url, public_key, email_verified, created_at
		FROM users
		WHERE LOWER(email) = LOWER($1)
	`, strings.TrimSpace(email)).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Phone, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.EmailVerified, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	return user, nil
}

func (s *Store) MarkEmailVerified(ctx context.Context, userID int64) error {
	_, err := s.db.Exec(ctx, `UPDATE users SET email_verified = TRUE WHERE id = $1`, userID)
	return err
}

func (s *Store) UpdateUserPassword(ctx context.Context, userID int64, password string) error {
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	tag, err := s.db.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) InvalidateEmailTokens(ctx context.Context, userID int64, purpose string) error {
	_, err := s.db.Exec(ctx, `
		UPDATE email_tokens SET used_at = NOW()
		WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL
	`, userID, purpose)
	return err
}

func (s *Store) CreateEmailToken(ctx context.Context, userID int64, purpose, plaintext string, ttl time.Duration) error {
	if err := s.InvalidateEmailTokens(ctx, userID, purpose); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `
		INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
		VALUES ($1, $2, $3, $4)
	`, userID, purpose, hashToken(plaintext), time.Now().Add(ttl))
	return err
}

func (s *Store) ConsumeEmailToken(ctx context.Context, userID int64, purpose, plaintext string) error {
	var tokenID int64
	err := s.db.QueryRow(ctx, `
		UPDATE email_tokens
		SET used_at = NOW()
		WHERE id = (
			SELECT id FROM email_tokens
			WHERE user_id = $1
			  AND purpose = $2
			  AND token_hash = $3
			  AND used_at IS NULL
			  AND expires_at > NOW()
			ORDER BY created_at DESC
			LIMIT 1
		)
		RETURNING id
	`, userID, purpose, hashToken(plaintext)).Scan(&tokenID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidToken
		}
		return err
	}
	return nil
}

func (s *Store) ConsumeEmailTokenByValue(ctx context.Context, purpose, plaintext string) (int64, error) {
	var userID int64
	err := s.db.QueryRow(ctx, `
		UPDATE email_tokens
		SET used_at = NOW()
		WHERE id = (
			SELECT id FROM email_tokens
			WHERE purpose = $1
			  AND token_hash = $2
			  AND used_at IS NULL
			  AND expires_at > NOW()
			ORDER BY created_at DESC
			LIMIT 1
		)
		RETURNING user_id
	`, purpose, hashToken(plaintext)).Scan(&userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrInvalidToken
		}
		return 0, err
	}
	return userID, nil
}
