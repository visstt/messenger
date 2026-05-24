package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"messenger/backend/internal/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type AdminUser struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"createdAt"`
}

type AdminUserUpdate struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Bio      string `json:"bio"`
}

type AdminChatPreview struct {
	ID          int64     `json:"id"`
	Kind        string    `json:"kind"`
	Title       string    `json:"title"`
	AvatarURL   string    `json:"avatarUrl"`
	UpdatedAt   time.Time `json:"updatedAt"`
	Peer        User      `json:"peer"`
	Participants []User   `json:"participants"`
	LastMessage *Message  `json:"lastMessage"`
}

type AdminMessage struct {
	Message
	DeletedContentAvailable bool `json:"deletedContentAvailable"`
}

func (s *Store) SeedAdminUser(ctx context.Context, username, password string) error {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	if username == "" || password == "" {
		return nil
	}

	var count int
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM admin_users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	_, err = s.db.Exec(ctx, `
		INSERT INTO admin_users (username, password_hash)
		VALUES (LOWER($1), $2)
	`, username, hash)
	return err
}

func (s *Store) AuthenticateAdmin(ctx context.Context, username, password string) (AdminUser, error) {
	var admin AdminUser
	var passwordHash string
	err := s.db.QueryRow(ctx, `
		SELECT id, username, created_at, password_hash
		FROM admin_users
		WHERE LOWER(username) = LOWER($1)
	`, strings.TrimSpace(username)).
		Scan(&admin.ID, &admin.Username, &admin.CreatedAt, &passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AdminUser{}, ErrForbidden
		}
		return AdminUser{}, err
	}
	if !auth.CheckPassword(passwordHash, password) {
		return AdminUser{}, ErrForbidden
	}
	return admin, nil
}

func (s *Store) GetAdminByID(ctx context.Context, adminID int64) (AdminUser, error) {
	var admin AdminUser
	err := s.db.QueryRow(ctx, `
		SELECT id, username, created_at
		FROM admin_users
		WHERE id = $1
	`, adminID).Scan(&admin.ID, &admin.Username, &admin.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return AdminUser{}, ErrNotFound
		}
		return AdminUser{}, err
	}
	return admin, nil
}

func (s *Store) archiveMessageBeforeDelete(ctx context.Context, messageID int64) error {
	_, err := s.db.Exec(ctx, `
		INSERT INTO message_audit (
			message_id, chat_id, sender_id, kind, text, file_url, file_name, duration_sec,
			encrypted_payload, encryption_meta, reply_to_message_id, created_at
		)
		SELECT
			id, chat_id, sender_id, kind, text, file_url, file_name, duration_sec,
			encrypted_payload, encryption_meta, reply_to_message_id, created_at
		FROM messages
		WHERE id = $1
		ON CONFLICT (message_id) DO NOTHING
	`, messageID)
	return err
}

func (s *Store) AdminListUsers(ctx context.Context, query string, limit, offset int) ([]User, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	pattern := "%" + strings.TrimSpace(query) + "%"
	rows, err := s.db.Query(ctx, `
		SELECT `+userSelectColumns+`
		FROM users
		WHERE $1 = ''
		   OR LOWER(name) LIKE LOWER($1)
		   OR LOWER(username) LIKE LOWER($1)
		   OR LOWER(email) LIKE LOWER($1)
		   OR phone LIKE $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, pattern, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		user, err := scanUserRow(rows)
		if err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *Store) AdminGetUser(ctx context.Context, userID int64) (User, error) {
	return s.GetUserByID(ctx, userID)
}

func (s *Store) AdminUpdateUser(ctx context.Context, userID int64, input AdminUserUpdate) (User, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.Username = strings.TrimSpace(input.Username)
	input.Email = strings.TrimSpace(strings.ToLower(input.Email))
	input.Phone = strings.TrimSpace(input.Phone)
	input.Bio = strings.TrimSpace(input.Bio)

	if input.Name == "" {
		return User{}, fmt.Errorf("name is required")
	}
	if input.Username == "" {
		return User{}, fmt.Errorf("username is required")
	}
	if input.Email == "" || !strings.Contains(input.Email, "@") {
		return User{}, fmt.Errorf("invalid email")
	}

	row := s.db.QueryRow(ctx, `
		UPDATE users
		SET name = $2,
			username = $3,
			email = LOWER($4),
			phone = $5,
			bio = $6
		WHERE id = $1
		RETURNING `+userSelectColumns+`
	`, userID, input.Name, input.Username, input.Email, input.Phone, input.Bio)
	user, err := scanUserRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return User{}, fmt.Errorf("username or email already exists")
		}
		return User{}, err
	}
	return user, nil
}

func (s *Store) AdminUpdateUserPassword(ctx context.Context, userID int64, password string) error {
	password = strings.TrimSpace(password)
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
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

func (s *Store) AdminListUserChats(ctx context.Context, userID int64) ([]AdminChatPreview, error) {
	if _, err := s.GetUserByID(ctx, userID); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			c.id,
			c.kind,
			c.title,
			c.avatar_url,
			c.updated_at,
			m.id, m.chat_id, m.sender_id, m.kind, m.text, m.file_url, m.file_name, m.duration_sec,
			m.encrypted_payload, m.encryption_meta, m.reply_to_message_id, m.pinned_at, m.edited_at, m.deleted_at, m.created_at,
			su.id, su.name, su.username, su.email, su.phone, su.bio, su.avatar_url, su.public_key, su.last_seen_at, su.created_at
		FROM chats c
		JOIN chat_participants self ON self.chat_id = c.id AND self.user_id = $1
		LEFT JOIN LATERAL (
			SELECT *
			FROM messages lm
			WHERE lm.chat_id = c.id
			ORDER BY lm.created_at DESC
			LIMIT 1
		) m ON TRUE
		LEFT JOIN users su ON su.id = m.sender_id
		ORDER BY c.updated_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []AdminChatPreview
	for rows.Next() {
		var preview AdminChatPreview
		var lastMessageID, lastMessageChatID, lastMessageSenderID *int64
		var lastMessageKind, lastMessageText, lastMessageFileURL, lastMessageFileName, lastMessageEncryptedPayload, lastMessageEncryptionMeta *string
		var lastMessageDuration *int
		var replyTo *int64
		var pinnedAt, editedAt, deletedAt, messageCreatedAt *time.Time
		var senderID *int64
		var senderName, senderUsername, senderEmail, senderPhone, senderBio, senderAvatar, senderPublicKey *string
		var senderLastSeen *time.Time
		var senderCreatedAt *time.Time

		if err := rows.Scan(
			&preview.ID,
			&preview.Kind,
			&preview.Title,
			&preview.AvatarURL,
			&preview.UpdatedAt,
			&lastMessageID, &lastMessageChatID, &lastMessageSenderID, &lastMessageKind, &lastMessageText, &lastMessageFileURL, &lastMessageFileName, &lastMessageDuration, &lastMessageEncryptedPayload, &lastMessageEncryptionMeta,
			&replyTo, &pinnedAt, &editedAt, &deletedAt, &messageCreatedAt,
			&senderID, &senderName, &senderUsername, &senderEmail, &senderPhone, &senderBio, &senderAvatar, &senderPublicKey, &senderLastSeen, &senderCreatedAt,
		); err != nil {
			return nil, err
		}

		if lastMessageID != nil {
			preview.LastMessage = &Message{
				ID:               *lastMessageID,
				ChatID:           derefInt64(lastMessageChatID),
				SenderID:         derefInt64(lastMessageSenderID),
				Kind:             derefString(lastMessageKind),
				Text:             derefString(lastMessageText),
				FileURL:          derefString(lastMessageFileURL),
				FileName:         derefString(lastMessageFileName),
				DurationSec:      derefInt(lastMessageDuration),
				EncryptedPayload: derefString(lastMessageEncryptedPayload),
				EncryptionMeta:   derefString(lastMessageEncryptionMeta),
				ReplyToMessage:   replyTo,
				PinnedAt:         pinnedAt,
				EditedAt:         editedAt,
				DeletedAt:        deletedAt,
				CreatedAt:        derefTime(messageCreatedAt),
			}
			if senderID != nil {
				preview.LastMessage.Sender = User{
					ID:        derefInt64(senderID),
					Name:      derefString(senderName),
					Username:  derefString(senderUsername),
					Email:     derefString(senderEmail),
					Phone:     derefString(senderPhone),
					Bio:       derefString(senderBio),
					AvatarURL: derefString(senderAvatar),
					PublicKey:  derefString(senderPublicKey),
					LastSeenAt: senderLastSeen,
					CreatedAt:  derefTime(senderCreatedAt),
				}
			}
		}

		participants, err := s.ListChatParticipants(ctx, preview.ID)
		if err != nil {
			return nil, err
		}
		preview.Participants = participants
		preview.Peer = peerForPreview(ChatPreview{
			ID:           preview.ID,
			Kind:         preview.Kind,
			Title:        preview.Title,
			AvatarURL:    preview.AvatarURL,
			Participants: participants,
		}, userID)
		chats = append(chats, preview)
	}
	return chats, rows.Err()
}

func (s *Store) AdminListChatMessages(ctx context.Context, chatID int64, limit, offset int) ([]AdminMessage, error) {
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			m.id, m.chat_id, m.sender_id, m.kind, m.text, m.file_url, m.file_name, m.duration_sec,
			m.encrypted_payload, m.encryption_meta, m.reply_to_message_id, m.pinned_at, m.edited_at, m.deleted_at, m.created_at,
			u.id, u.name, u.username, u.email, u.phone, u.bio, u.avatar_url, u.public_key, u.created_at,
			a.text, a.file_url, a.file_name, a.duration_sec, a.encrypted_payload, a.encryption_meta
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		LEFT JOIN message_audit a ON a.message_id = m.id
		WHERE m.chat_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3
	`, chatID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []AdminMessage
	for rows.Next() {
		var msg AdminMessage
		var auditText, auditFileURL, auditFileName, auditEncryptedPayload, auditEncryptionMeta *string
		var auditDuration *int

		if err := rows.Scan(
			&msg.ID, &msg.ChatID, &msg.SenderID, &msg.Kind, &msg.Text, &msg.FileURL, &msg.FileName, &msg.DurationSec,
			&msg.EncryptedPayload, &msg.EncryptionMeta, &msg.ReplyToMessage, &msg.PinnedAt, &msg.EditedAt, &msg.DeletedAt, &msg.CreatedAt,
			&msg.Sender.ID, &msg.Sender.Name, &msg.Sender.Username, &msg.Sender.Email, &msg.Sender.Phone, &msg.Sender.Bio, &msg.Sender.AvatarURL, &msg.Sender.PublicKey, &msg.Sender.CreatedAt,
			&auditText, &auditFileURL, &auditFileName, &auditDuration, &auditEncryptedPayload, &auditEncryptionMeta,
		); err != nil {
			return nil, err
		}

		if msg.DeletedAt != nil {
			if auditText != nil {
				msg.Text = derefString(auditText)
				msg.FileURL = derefString(auditFileURL)
				msg.FileName = derefString(auditFileName)
				msg.DurationSec = derefInt(auditDuration)
				msg.EncryptedPayload = derefString(auditEncryptedPayload)
				msg.EncryptionMeta = derefString(auditEncryptionMeta)
				msg.DeletedContentAvailable = msg.Text != "" || msg.FileURL != "" || msg.EncryptedPayload != ""
			}
		}

		items = append(items, msg)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	reverseAdminMessages(items)
	return items, nil
}

func reverseAdminMessages(items []AdminMessage) {
	for i, j := 0, len(items)-1; i < j; i, j = i+1, j-1 {
		items[i], items[j] = items[j], items[i]
	}
}
