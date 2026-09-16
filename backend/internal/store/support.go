package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type SupportConversation struct {
	ID               int64     `json:"id"`
	ExternalID       string    `json:"externalId"`
	VisitorName      string    `json:"visitorName"`
	VisitorPhone     string    `json:"visitorPhone"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
	AssignedToUserID *int64    `json:"assignedToUserId,omitempty"`
	AssignedToName   string    `json:"assignedToName,omitempty"`
}

type SupportMessage struct {
	ID             int64     `json:"id"`
	ConversationID int64     `json:"conversationId"`
	SenderType     string    `json:"senderType"`
	SenderUserID   *int64    `json:"senderUserId,omitempty"`
	Text           string    `json:"text"`
	CreatedAt      time.Time `json:"createdAt"`
}

func (s *Store) CreateSupportConversation(
	ctx context.Context,
	externalID string,
	visitorName string,
	visitorPhone string,
) (SupportConversation, error) {
	externalID = strings.TrimSpace(externalID)
	visitorName = strings.TrimSpace(visitorName)
	visitorPhone = strings.TrimSpace(visitorPhone)

	if externalID == "" {
		return SupportConversation{}, errors.New("external id is required")
	}

	var conversation SupportConversation

	err := s.db.QueryRow(ctx, `
		INSERT INTO support_conversations (
			external_id,
			visitor_name,
			visitor_phone
		)
		VALUES ($1, $2, $3)
		ON CONFLICT (external_id)
		DO UPDATE SET
			visitor_name = EXCLUDED.visitor_name,
			visitor_phone = EXCLUDED.visitor_phone,
			updated_at = NOW()
		RETURNING
			id,
			external_id,
			visitor_name,
			visitor_phone,
			status,
			created_at,
			updated_at
	`,
		externalID,
		visitorName,
		visitorPhone,
	).Scan(
		&conversation.ID,
		&conversation.ExternalID,
		&conversation.VisitorName,
		&conversation.VisitorPhone,
		&conversation.Status,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	)

	return conversation, err
}

func (s *Store) GetSupportConversation(
	ctx context.Context,
	conversationID int64,
) (SupportConversation, error) {
	var conversation SupportConversation

	err := s.db.QueryRow(ctx, `
		SELECT
			sc.id,
			sc.external_id,
			sc.visitor_name,
			sc.visitor_phone,
			sc.status,
			sc.created_at,
			sc.updated_at,
			sc.assigned_to_user_id,
			COALESCE(u.name, '') as assigned_to_name
		FROM support_conversations sc
		LEFT JOIN users u ON u.id = sc.assigned_to_user_id
		WHERE sc.id = $1
	`, conversationID).Scan(
		&conversation.ID,
		&conversation.ExternalID,
		&conversation.VisitorName,
		&conversation.VisitorPhone,
		&conversation.Status,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
		&conversation.AssignedToUserID,
		&conversation.AssignedToName,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return SupportConversation{}, ErrNotFound
	}

	return conversation, err
}

func (s *Store) ListSupportConversations(
	ctx context.Context,
) ([]SupportConversation, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			sc.id,
			sc.external_id,
			sc.visitor_name,
			sc.visitor_phone,
			sc.status,
			sc.created_at,
			sc.updated_at,
			sc.assigned_to_user_id,
			COALESCE(u.name, '') as assigned_to_name
		FROM support_conversations sc
		LEFT JOIN users u ON u.id = sc.assigned_to_user_id
		ORDER BY sc.updated_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SupportConversation

	for rows.Next() {
		var item SupportConversation

		if err := rows.Scan(
			&item.ID,
			&item.ExternalID,
			&item.VisitorName,
			&item.VisitorPhone,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
			&item.AssignedToUserID,
			&item.AssignedToName,
		); err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

// AssignSupportConversation назначает диалог на оператора.
func (s *Store) AssignSupportConversation(
	ctx context.Context,
	conversationID int64,
	userID int64,
) error {
	_, err := s.db.Exec(ctx, `
		UPDATE support_conversations
		SET assigned_to_user_id = $2, updated_at = NOW()
		WHERE id = $1
	`, conversationID, userID)
	return err
}

// UnassignSupportConversation снимает назначение с диалога.
func (s *Store) UnassignSupportConversation(
	ctx context.Context,
	conversationID int64,
) error {
	_, err := s.db.Exec(ctx, `
		UPDATE support_conversations
		SET assigned_to_user_id = NULL, updated_at = NOW()
		WHERE id = $1
	`, conversationID)
	return err
}

func (s *Store) CreateSupportMessage(
	ctx context.Context,
	conversationID int64,
	senderType string,
	senderUserID *int64,
	text string,
) (SupportMessage, error) {
	senderType = strings.TrimSpace(senderType)
	text = strings.TrimSpace(text)

	if conversationID <= 0 {
		return SupportMessage{}, errors.New("conversation id is required")
	}

	if text == "" {
		return SupportMessage{}, errors.New("message text is required")
	}

	switch senderType {
	case "visitor", "worker":
	default:
		return SupportMessage{}, errors.New("invalid sender type")
	}

	var message SupportMessage

	err := s.db.QueryRow(ctx, `
		INSERT INTO support_messages (
			conversation_id,
			sender_type,
			sender_user_id,
			text
		)
		VALUES ($1, $2, $3, $4)
		RETURNING
			id,
			conversation_id,
			sender_type,
			sender_user_id,
			text,
			created_at
	`,
		conversationID,
		senderType,
		senderUserID,
		text,
	).Scan(
		&message.ID,
		&message.ConversationID,
		&message.SenderType,
		&message.SenderUserID,
		&message.Text,
		&message.CreatedAt,
	)

	if err != nil {
		return SupportMessage{}, err
	}

	_, err = s.db.Exec(ctx, `
		UPDATE support_conversations
		SET updated_at = NOW()
		WHERE id = $1
	`, conversationID)

	if err != nil {
		return SupportMessage{}, err
	}

	return message, nil
}

func (s *Store) ListSupportMessages(
	ctx context.Context,
	conversationID int64,
) ([]SupportMessage, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			id,
			conversation_id,
			sender_type,
			sender_user_id,
			text,
			created_at
		FROM support_messages
		WHERE conversation_id = $1
		ORDER BY created_at ASC
	`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []SupportMessage

	for rows.Next() {
		var item SupportMessage

		if err := rows.Scan(
			&item.ID,
			&item.ConversationID,
			&item.SenderType,
			&item.SenderUserID,
			&item.Text,
			&item.CreatedAt,
		); err != nil {
			return nil, err
		}

		items = append(items, item)
	}

	return items, rows.Err()
}

func (s *Store) IsSupportWorker(
	ctx context.Context,
	userID int64,
) (bool, error) {
	var exists bool

	err := s.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM support_workers
			WHERE user_id = $1
		)
	`, userID).Scan(&exists)

	return exists, err
}

func (s *Store) AddSupportWorker(
	ctx context.Context,
	userID int64,
) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO support_workers (user_id)
		VALUES ($1)
		ON CONFLICT (user_id) DO NOTHING
	`, userID)

	return err
}

func (s *Store) RemoveSupportWorker(
	ctx context.Context,
	userID int64,
) error {
	_, err := s.db.Exec(ctx, `
		DELETE FROM support_workers
		WHERE user_id = $1
	`, userID)

	return err
}

func (s *Store) ListSupportWorkerIDs(
	ctx context.Context,
) ([]int64, error) {
	rows, err := s.db.Query(ctx, `
		SELECT user_id
		FROM support_workers
		ORDER BY user_id
	`)
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

func (s *Store) GetSupportConversationByExternalID(
	ctx context.Context,
	externalID string,
) (SupportConversation, error) {
	var conversation SupportConversation

	err := s.db.QueryRow(
		ctx,
		`
		SELECT
			id,
			external_id,
			visitor_name,
			visitor_phone,
			status,
			created_at,
			updated_at
		FROM support_conversations
		WHERE external_id = $1
		`,
		externalID,
	).Scan(
		&conversation.ID,
		&conversation.ExternalID,
		&conversation.VisitorName,
		&conversation.VisitorPhone,
		&conversation.Status,
		&conversation.CreatedAt,
		&conversation.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SupportConversation{}, ErrNotFound
		}

		return SupportConversation{}, err
	}

	return conversation, nil
}
