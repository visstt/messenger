package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// NormalizeRegistration trims and lowercases email for consistent checks.
func NormalizeRegistration(input Credentials) Credentials {
	input.Name = strings.TrimSpace(input.Name)
	input.Username = strings.TrimSpace(input.Username)
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Password = strings.TrimSpace(input.Password)
	return input
}

func ValidateRegistration(input Credentials) error {
	input = NormalizeRegistration(input)

	if input.Name == "" {
		return fmt.Errorf("name is required")
	}
	if input.Username == "" {
		return fmt.Errorf("укажите имя пользователя")
	}
	if input.Email == "" {
		return fmt.Errorf("email is required")
	}
	if !strings.Contains(input.Email, "@") || !strings.Contains(input.Email, ".") {
		return fmt.Errorf("некорректный email")
	}
	if len(input.Password) < 8 {
		return fmt.Errorf("пароль должен быть не короче 8 символов")
	}
	return nil
}

// RegistrationConflict reports which unique field is already taken.
func (s *Store) RegistrationConflict(ctx context.Context, username, email string) (string, error) {
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(strings.ToLower(email))

	var existingUsername string
	err := s.db.QueryRow(ctx, `
		SELECT username FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1
	`, username).Scan(&existingUsername)
	if err == nil {
		return "username", nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}

	var existingEmail string
	err = s.db.QueryRow(ctx, `
		SELECT email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1
	`, email).Scan(&existingEmail)
	if err == nil {
		return "email", nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return "", err
}

func MapCreateUserError(err error) string {
	if err == nil {
		return ""
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		constraint := strings.ToLower(pgErr.ConstraintName)
		switch {
		case strings.Contains(constraint, "username"):
			return "это имя пользователя уже занято"
		case strings.Contains(constraint, "email"):
			return "эта почта уже зарегистрирована"
		default:
			return "имя пользователя или почта уже заняты"
		}
	}

	return "не удалось создать аккаунт"
}
