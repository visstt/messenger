package store

import (
	"context"
)

// PushSubscription хранит Web Push подписку устройства.
type PushSubscription struct {
	ID       int64  `json:"id"`
	UserID   int64  `json:"userId"`
	Endpoint string `json:"endpoint"`
	P256dh   string `json:"p256dh"`
	Auth     string `json:"auth"`
}

// SavePushSubscription сохраняет или обновляет push-подписку пользователя.
// Если подписка с таким endpoint уже существует — обновляет ключи.
func (s *Store) SavePushSubscription(ctx context.Context, userID int64, endpoint, p256dh, auth string) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, endpoint) DO UPDATE
		SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
	`, userID, endpoint, p256dh, auth)
	return err
}

// DeletePushSubscription удаляет push-подписку по endpoint.
func (s *Store) DeletePushSubscription(ctx context.Context, userID int64, endpoint string) error {
	_, err := s.db.Exec(ctx, `
		DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2
	`, userID, endpoint)
	return err
}

// GetPushSubscriptionsByUserIDs возвращает все push-подписки для списка пользователей.
func (s *Store) GetPushSubscriptionsByUserIDs(ctx context.Context, userIDs []int64) ([]PushSubscription, error) {
	if len(userIDs) == 0 {
		return nil, nil
	}

	rows, err := s.db.Query(ctx, `
		SELECT id, user_id, endpoint, p256dh, auth
		FROM push_subscriptions
		WHERE user_id = ANY($1)
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []PushSubscription
	for rows.Next() {
		var sub PushSubscription
		if err := rows.Scan(&sub.ID, &sub.UserID, &sub.Endpoint, &sub.P256dh, &sub.Auth); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}
