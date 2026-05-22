package store

import "time"

const userSelectColumns = `id, name, username, email, phone, bio, avatar_url, public_key, last_seen_at, created_at`

func scanUserRow(
	scanner interface {
		Scan(dest ...any) error
	},
) (User, error) {
	var user User
	var lastSeen *time.Time
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
	)
	if err != nil {
		return User{}, err
	}
	user.LastSeenAt = lastSeen
	return user, nil
}
