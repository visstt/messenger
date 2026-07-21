package store

import "time"

const userSelectColumns = `id, name, username, email, phone, bio, avatar_url, public_key, last_seen_at, created_at, (email_verified_at IS NOT NULL) AS email_verified`

func scanUserRow(
	scanner interface {
		Scan(dest ...any) error
	},
) (User, error) {
	var user User
	var lastSeen *time.Time
	var emailVerified bool
	err := scanner.Scan(
		&user.ID,
		&user.Name,
		&user.Username,
		&user.Email,
		&user.Phone,
		&user.Bio,
		&user.AvatarURL,
		&user.PublicKey,
		&lastSeen,
		&user.CreatedAt,
		&emailVerified,
	)
	if err != nil {
		return User{}, err
	}
	user.LastSeenAt = lastSeen
	user.EmailVerified = emailVerified
	return user, nil
}
