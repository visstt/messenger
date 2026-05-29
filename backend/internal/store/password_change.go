package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"messenger/backend/internal/auth"

	"github.com/jackc/pgx/v5"
)

func (s *Store) UpdateUserPassword(ctx context.Context, userID int64, currentPassword string, newPassword string) error {
	currentPassword = strings.TrimSpace(currentPassword)
	newPassword = strings.TrimSpace(newPassword)

	if len(newPassword) < 8 {
		return fmt.Errorf("пароль должен быть не короче 8 символов")
	}

	var passwordHash string
	err := s.db.QueryRow(ctx, `SELECT password_hash FROM users WHERE id = $1`, userID).Scan(&passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	if !auth.CheckPassword(passwordHash, currentPassword) {
		return ErrForbidden
	}

	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, userID, hash)
	return err
}

