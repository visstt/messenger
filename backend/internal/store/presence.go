package store

import (
	"context"
	"time"
)

func (s *Store) TouchLastSeen(ctx context.Context, userID int64) (time.Time, error) {
	var lastSeen time.Time
	err := s.db.QueryRow(ctx, `
		UPDATE users
		SET last_seen_at = NOW()
		WHERE id = $1
		RETURNING last_seen_at
	`, userID).Scan(&lastSeen)
	return lastSeen, err
}

func (s *Store) GetLastSeenAt(ctx context.Context, userID int64) (*time.Time, error) {
	var lastSeen *time.Time
	err := s.db.QueryRow(ctx, `
		SELECT last_seen_at
		FROM users
		WHERE id = $1
	`, userID).Scan(&lastSeen)
	if err != nil {
		return nil, err
	}
	return lastSeen, nil
}

// ListRelatedUserIDs returns users who share at least one chat with the given user.
func (s *Store) ListRelatedUserIDs(ctx context.Context, userID int64) ([]int64, error) {
	rows, err := s.db.Query(ctx, `
		SELECT DISTINCT cp2.user_id
		FROM chat_participants cp1
		JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
		WHERE cp1.user_id = $1 AND cp2.user_id <> $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}
