package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"messenger/backend/internal/auth"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	db *pgxpool.Pool
}

type User struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Bio       string    `json:"bio"`
	AvatarURL string    `json:"avatarUrl"`
	PublicKey string    `json:"publicKey"`
	CreatedAt time.Time `json:"createdAt"`
}

type Message struct {
	ID               int64      `json:"id"`
	ChatID           int64      `json:"chatId"`
	SenderID         int64      `json:"senderId"`
	Kind             string     `json:"kind"`
	Text             string     `json:"text"`
	FileURL          string     `json:"fileUrl"`
	FileName         string     `json:"fileName"`
	DurationSec      int        `json:"durationSec"`
	EncryptedPayload string     `json:"encryptedPayload"`
	EncryptionMeta   string     `json:"encryptionMeta"`
	ReplyToMessage   *int64     `json:"replyToMessageId"`
	EditedAt         *time.Time `json:"editedAt"`
	DeletedAt        *time.Time `json:"deletedAt"`
	CreatedAt        time.Time  `json:"createdAt"`
	Sender           User       `json:"sender"`
	Status           string     `json:"status"`
}

type ChatPreview struct {
	ID           int64     `json:"id"`
	Kind         string    `json:"kind"`
	Title        string    `json:"title"`
	AvatarURL    string    `json:"avatarUrl"`
	E2EEEnabled  bool      `json:"e2eeEnabled"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Peer         User      `json:"peer"`
	Participants []User    `json:"participants"`
	LastMessage  *Message  `json:"lastMessage"`
	UnreadCount  int       `json:"unreadCount"`
}

type ChatDetails struct {
	ID           int64     `json:"id"`
	Kind         string    `json:"kind"`
	Title        string    `json:"title"`
	AvatarURL    string    `json:"avatarUrl"`
	E2EEEnabled  bool      `json:"e2eeEnabled"`
	UpdatedAt    time.Time `json:"updatedAt"`
	Peer         User      `json:"peer"`
	Participants []User    `json:"participants"`
}

type Credentials struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type ProfileUpdate struct {
	Name      string `json:"name"`
	Username  string `json:"username"`
	Bio       string `json:"bio"`
	AvatarURL string `json:"avatarUrl"`
}

type NewMessage struct {
	ChatID           int64
	SenderID         int64
	Kind             string
	Text             string
	FileURL          string
	FileName         string
	DurationSec      int
	EncryptedPayload string
	EncryptionMeta   string
	ReplyToMessageID *int64
}

var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")

func New(db *pgxpool.Pool) *Store {
	return &Store{db: db}
}

func (s *Store) Migrate(ctx context.Context) error {
	schema := `
CREATE TABLE IF NOT EXISTS users (
	id BIGSERIAL PRIMARY KEY,
	name TEXT NOT NULL,
	username TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	bio TEXT NOT NULL DEFAULT '',
	avatar_url TEXT NOT NULL DEFAULT '',
	public_key TEXT NOT NULL DEFAULT '',
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
	id BIGSERIAL PRIMARY KEY,
	kind TEXT NOT NULL DEFAULT 'private',
	title TEXT NOT NULL DEFAULT '',
	avatar_url TEXT NOT NULL DEFAULT '',
	e2ee_enabled BOOLEAN NOT NULL DEFAULT FALSE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_participants (
	chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
	user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	last_read_message_id BIGINT,
	PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
	id BIGSERIAL PRIMARY KEY,
	chat_id BIGINT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
	sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	kind TEXT NOT NULL,
	text TEXT NOT NULL DEFAULT '',
	file_url TEXT NOT NULL DEFAULT '',
	file_name TEXT NOT NULL DEFAULT '',
	duration_sec INTEGER NOT NULL DEFAULT 0,
	encrypted_payload TEXT NOT NULL DEFAULT '',
	encryption_meta TEXT NOT NULL DEFAULT '',
	reply_to_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
	edited_at TIMESTAMPTZ,
	deleted_at TIMESTAMPTZ,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
ALTER TABLE chats ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '';
ALTER TABLE chats ADD COLUMN IF NOT EXISTS e2ee_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS public_key TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted_payload TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encryption_meta TEXT NOT NULL DEFAULT '';
`
	_, err := s.db.Exec(ctx, schema)
	return err
}

func (s *Store) SeedDemoData(ctx context.Context) error {
	var count int
	if err := s.db.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hashAlice, err := auth.HashPassword("alice12345")
	if err != nil {
		return err
	}
	hashBob, err := auth.HashPassword("bob12345")
	if err != nil {
		return err
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var aliceID, bobID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO users (name, username, email, password_hash, bio, avatar_url)
		VALUES ('Alice Martin', 'alice', 'alice@example.com', $1, 'Product designer and early demo user.', '')
		RETURNING id
	`, hashAlice).Scan(&aliceID); err != nil {
		return err
	}
	if err := tx.QueryRow(ctx, `
		INSERT INTO users (name, username, email, password_hash, bio, avatar_url)
		VALUES ('Bob Carter', 'bob', 'bob@example.com', $1, 'Backend engineer who likes concise chats.', '')
		RETURNING id
	`, hashBob).Scan(&bobID); err != nil {
		return err
	}

	var chatID int64
	if err := tx.QueryRow(ctx, `INSERT INTO chats (kind) VALUES ('private') RETURNING id`).Scan(&chatID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO chat_participants (chat_id, user_id) VALUES
		($1, $2), ($1, $3)
	`, chatID, aliceID, bobID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO messages (chat_id, sender_id, kind, text)
		VALUES
		($1, $2, 'text', 'Welcome to the MVP messenger. This demo chat is ready.'),
		($1, $3, 'text', 'Search users, open private chats, and send text, image or voice messages.')
	`, chatID, aliceID, bobID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE chats SET updated_at = NOW() WHERE id = $1
	`, chatID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE chat_participants
		SET last_read_message_id = (SELECT MAX(id) FROM messages WHERE chat_id = $1)
		WHERE chat_id = $1
	`, chatID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *Store) CreateUser(ctx context.Context, input Credentials) (User, error) {
	hash, err := auth.HashPassword(input.Password)
	if err != nil {
		return User{}, err
	}

	var user User
	err = s.db.QueryRow(ctx, `
		INSERT INTO users (name, username, email, password_hash)
		VALUES ($1, LOWER($2), LOWER($3), $4)
		RETURNING id, name, username, email, bio, avatar_url, public_key, created_at
	`, strings.TrimSpace(input.Name), strings.TrimSpace(input.Username), strings.TrimSpace(input.Email), hash).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt)
	return user, err
}

func (s *Store) AuthenticateUser(ctx context.Context, identifier, password string) (User, error) {
	var user User
	var passwordHash string
	err := s.db.QueryRow(ctx, `
		SELECT id, name, username, email, bio, avatar_url, public_key, created_at, password_hash
		FROM users
		WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
	`, strings.TrimSpace(identifier)).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt, &passwordHash)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	if !auth.CheckPassword(passwordHash, password) {
		return User{}, ErrForbidden
	}
	return user, nil
}

func (s *Store) GetUserByID(ctx context.Context, userID int64) (User, error) {
	var user User
	err := s.db.QueryRow(ctx, `
		SELECT id, name, username, email, bio, avatar_url, public_key, created_at
		FROM users
		WHERE id = $1
	`, userID).Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return User{}, ErrNotFound
		}
		return User{}, err
	}
	return user, nil
}

func (s *Store) SearchUsers(ctx context.Context, currentUserID int64, query string) ([]User, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, name, username, email, bio, avatar_url, public_key, created_at
		FROM users
		WHERE id <> $1
		  AND (
			LOWER(name) LIKE LOWER($2)
			OR LOWER(username) LIKE LOWER($2)
			OR LOWER(email) LIKE LOWER($2)
		  )
		ORDER BY name
		LIMIT 20
	`, currentUserID, "%"+strings.TrimSpace(query)+"%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *Store) UpdateProfile(ctx context.Context, userID int64, input ProfileUpdate) (User, error) {
	var user User
	err := s.db.QueryRow(ctx, `
		UPDATE users
		SET name = $2,
			username = LOWER($3),
			bio = $4,
			avatar_url = $5
		WHERE id = $1
		RETURNING id, name, username, email, bio, avatar_url, public_key, created_at
	`, userID, strings.TrimSpace(input.Name), strings.TrimSpace(input.Username), strings.TrimSpace(input.Bio), strings.TrimSpace(input.AvatarURL)).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt)
	return user, err
}

func (s *Store) UpdateAvatar(ctx context.Context, userID int64, avatarURL string) (User, error) {
	var user User
	err := s.db.QueryRow(ctx, `
		UPDATE users
		SET avatar_url = $2
		WHERE id = $1
		RETURNING id, name, username, email, bio, avatar_url, public_key, created_at
	`, userID, strings.TrimSpace(avatarURL)).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt)
	return user, err
}

func (s *Store) UpdatePublicKey(ctx context.Context, userID int64, publicKey string) (User, error) {
	var user User
	err := s.db.QueryRow(ctx, `
		UPDATE users
		SET public_key = $2
		WHERE id = $1
		RETURNING id, name, username, email, bio, avatar_url, public_key, created_at
	`, userID, strings.TrimSpace(publicKey)).
		Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt)
	return user, err
}

func (s *Store) EnableChatE2EE(ctx context.Context, currentUserID, chatID int64) (ChatDetails, Message, []int64, bool, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ChatDetails{}, Message{}, nil, false, err
	}
	defer tx.Rollback(ctx)

	var enabled bool
	err = tx.QueryRow(ctx, `
		SELECT c.e2ee_enabled
		FROM chats c
		JOIN chat_participants cp ON cp.chat_id = c.id AND cp.user_id = $1
		WHERE c.id = $2
	`, currentUserID, chatID).Scan(&enabled)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ChatDetails{}, Message{}, nil, false, ErrNotFound
		}
		return ChatDetails{}, Message{}, nil, false, err
	}

	recipientIDs, err := s.GetRecipientIDs(ctx, currentUserID, chatID)
	if err != nil {
		return ChatDetails{}, Message{}, nil, false, err
	}

	chatWasUpdated := false
	var systemMessage Message

	if !enabled {
		if _, err := tx.Exec(ctx, `
			UPDATE chats
			SET e2ee_enabled = TRUE, updated_at = NOW()
			WHERE id = $1
		`, chatID); err != nil {
			return ChatDetails{}, Message{}, nil, false, err
		}

		if err := tx.QueryRow(ctx, `
			INSERT INTO messages (chat_id, sender_id, kind, text)
			VALUES ($1, $2, 'system', $3)
			RETURNING id, chat_id, sender_id, kind, text, file_url, file_name, duration_sec, encrypted_payload, encryption_meta, reply_to_message_id, edited_at, deleted_at, created_at
		`, chatID, currentUserID, "Шифрование сообщений включено. Кроме участников диалога никто не сможет получить к ним доступ.").Scan(
			&systemMessage.ID,
			&systemMessage.ChatID,
			&systemMessage.SenderID,
			&systemMessage.Kind,
			&systemMessage.Text,
			&systemMessage.FileURL,
			&systemMessage.FileName,
			&systemMessage.DurationSec,
			&systemMessage.EncryptedPayload,
			&systemMessage.EncryptionMeta,
			&systemMessage.ReplyToMessage,
			&systemMessage.EditedAt,
			&systemMessage.DeletedAt,
			&systemMessage.CreatedAt,
		); err != nil {
			return ChatDetails{}, Message{}, nil, false, err
		}

		user, err := s.GetUserByID(ctx, currentUserID)
		if err != nil {
			return ChatDetails{}, Message{}, nil, false, err
		}
		systemMessage.Sender = user
		systemMessage.Status = "sent"
		chatWasUpdated = true
	}

	if err := tx.Commit(ctx); err != nil {
		return ChatDetails{}, Message{}, nil, false, err
	}

	chat, err := s.GetChatDetails(ctx, currentUserID, chatID)
	return chat, systemMessage, recipientIDs, chatWasUpdated, err
}

func (s *Store) CreateOrGetPrivateChat(ctx context.Context, currentUserID, otherUserID int64) (ChatDetails, error) {
	if currentUserID == otherUserID {
		return ChatDetails{}, ErrForbidden
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ChatDetails{}, err
	}
	defer tx.Rollback(ctx)

	var chatID int64
	err = tx.QueryRow(ctx, `
		SELECT cp1.chat_id
		FROM chat_participants cp1
		JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id
		JOIN chats c ON c.id = cp1.chat_id
		WHERE c.kind = 'private' AND cp1.user_id = $1 AND cp2.user_id = $2
		LIMIT 1
	`, currentUserID, otherUserID).Scan(&chatID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return ChatDetails{}, err
	}

	if errors.Is(err, pgx.ErrNoRows) {
		if err := tx.QueryRow(ctx, `INSERT INTO chats (kind) VALUES ('private') RETURNING id`).Scan(&chatID); err != nil {
			return ChatDetails{}, err
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2), ($1, $3)
		`, chatID, currentUserID, otherUserID); err != nil {
			return ChatDetails{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ChatDetails{}, err
	}
	return s.GetChatDetails(ctx, currentUserID, chatID)
}

func (s *Store) CreateGroupChat(ctx context.Context, currentUserID int64, title string, memberIDs []int64) (ChatDetails, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return ChatDetails{}, fmt.Errorf("title is required")
	}

	seen := map[int64]bool{currentUserID: true}
	participants := []int64{currentUserID}
	for _, id := range memberIDs {
		if id <= 0 || seen[id] {
			continue
		}
		seen[id] = true
		participants = append(participants, id)
	}
	if len(participants) < 3 {
		return ChatDetails{}, fmt.Errorf("group chat requires at least three participants")
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return ChatDetails{}, err
	}
	defer tx.Rollback(ctx)

	var chatID int64
	if err := tx.QueryRow(ctx, `
		INSERT INTO chats (kind, title) VALUES ('group', $1) RETURNING id
	`, title).Scan(&chatID); err != nil {
		return ChatDetails{}, err
	}

	for _, id := range participants {
		if _, err := tx.Exec(ctx, `
			INSERT INTO chat_participants (chat_id, user_id) VALUES ($1, $2)
		`, chatID, id); err != nil {
			return ChatDetails{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return ChatDetails{}, err
	}
	return s.GetChatDetails(ctx, currentUserID, chatID)
}

func (s *Store) GetChatDetails(ctx context.Context, currentUserID, chatID int64) (ChatDetails, error) {
	var chat ChatDetails
	err := s.db.QueryRow(ctx, `
		SELECT c.id, c.kind, c.title, c.avatar_url, c.e2ee_enabled, c.updated_at
		FROM chats c
		JOIN chat_participants self ON self.chat_id = c.id AND self.user_id = $1
		WHERE c.id = $2
	`, currentUserID, chatID).
		Scan(&chat.ID, &chat.Kind, &chat.Title, &chat.AvatarURL, &chat.E2EEEnabled, &chat.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ChatDetails{}, ErrNotFound
		}
		return ChatDetails{}, err
	}
	participants, err := s.ListChatParticipants(ctx, chatID)
	if err != nil {
		return ChatDetails{}, err
	}
	chat.Participants = participants
	chat.Peer = peerForChat(chat, currentUserID)
	return chat, nil
}

func (s *Store) ListChatParticipants(ctx context.Context, chatID int64) ([]User, error) {
	rows, err := s.db.Query(ctx, `
		SELECT u.id, u.name, u.username, u.email, u.bio, u.avatar_url, u.public_key, u.created_at
		FROM chat_participants cp
		JOIN users u ON u.id = cp.user_id
		WHERE cp.chat_id = $1
		ORDER BY u.name
	`, chatID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Bio, &user.AvatarURL, &user.PublicKey, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, rows.Err()
}

func (s *Store) ListChats(ctx context.Context, currentUserID int64) ([]ChatPreview, error) {
	rows, err := s.db.Query(ctx, `
		SELECT
			c.id,
			c.kind,
			c.title,
			c.avatar_url,
			c.e2ee_enabled,
			c.updated_at,
			m.id, m.chat_id, m.sender_id, m.kind, m.text, m.file_url, m.file_name, m.duration_sec, m.encrypted_payload, m.encryption_meta,
			m.reply_to_message_id, m.edited_at, m.deleted_at, m.created_at,
			su.id, su.name, su.username, su.email, su.bio, su.avatar_url, su.public_key, su.created_at,
			COALESCE((
				SELECT COUNT(*)
				FROM messages unread
				WHERE unread.chat_id = c.id
				  AND unread.sender_id <> $1
				  AND unread.deleted_at IS NULL
				  AND unread.id > COALESCE(self.last_read_message_id, 0)
			), 0) AS unread_count,
			COALESCE((
				SELECT MIN(COALESCE(peer.last_read_message_id, 0))
				FROM chat_participants peer
				WHERE peer.chat_id = c.id AND peer.user_id <> $1
			), 0) AS peer_last_read
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
	`, currentUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chats []ChatPreview
	for rows.Next() {
		var preview ChatPreview
		var lastMessageID, lastMessageChatID, lastMessageSenderID *int64
		var lastMessageKind, lastMessageText, lastMessageFileURL, lastMessageFileName, lastMessageEncryptedPayload, lastMessageEncryptionMeta *string
		var lastMessageDuration *int
		var replyTo *int64
		var editedAt, deletedAt, messageCreatedAt *time.Time
		var senderID *int64
		var senderName, senderUsername, senderEmail, senderBio, senderAvatar, senderPublicKey *string
		var senderCreatedAt *time.Time
		var peerLastRead int64

		if err := rows.Scan(
			&preview.ID,
			&preview.Kind,
			&preview.Title,
			&preview.AvatarURL,
			&preview.E2EEEnabled,
			&preview.UpdatedAt,
			&lastMessageID, &lastMessageChatID, &lastMessageSenderID, &lastMessageKind, &lastMessageText, &lastMessageFileURL, &lastMessageFileName, &lastMessageDuration, &lastMessageEncryptedPayload, &lastMessageEncryptionMeta,
			&replyTo, &editedAt, &deletedAt, &messageCreatedAt,
			&senderID, &senderName, &senderUsername, &senderEmail, &senderBio, &senderAvatar, &senderPublicKey, &senderCreatedAt,
			&preview.UnreadCount,
			&peerLastRead,
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
				EditedAt:         editedAt,
				DeletedAt:        deletedAt,
				CreatedAt:        derefTime(messageCreatedAt),
				Status:           statusForMessage(derefInt64(lastMessageSenderID), currentUserID, *lastMessageID, peerLastRead),
			}
			if senderID != nil {
				preview.LastMessage.Sender = User{
					ID:        derefInt64(senderID),
					Name:      derefString(senderName),
					Username:  derefString(senderUsername),
					Email:     derefString(senderEmail),
					Bio:       derefString(senderBio),
					AvatarURL: derefString(senderAvatar),
					PublicKey: derefString(senderPublicKey),
					CreatedAt: derefTime(senderCreatedAt),
				}
			}
		}

		participants, err := s.ListChatParticipants(ctx, preview.ID)
		if err != nil {
			return nil, err
		}
		preview.Participants = participants
		preview.Peer = peerForPreview(preview, currentUserID)
		chats = append(chats, preview)
	}
	return chats, rows.Err()
}

func (s *Store) ListMessages(ctx context.Context, currentUserID, chatID int64, limit int) (ChatDetails, []Message, error) {
	chat, err := s.GetChatDetails(ctx, currentUserID, chatID)
	if err != nil {
		return ChatDetails{}, nil, err
	}

	var peerLastRead int64
	if err := s.db.QueryRow(ctx, `
		SELECT COALESCE(MIN(COALESCE(cp.last_read_message_id, 0)), 0)
		FROM chat_participants cp
		WHERE cp.chat_id = $1 AND cp.user_id <> $2
	`, chatID, currentUserID).Scan(&peerLastRead); err != nil {
		return ChatDetails{}, nil, err
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			m.id, m.chat_id, m.sender_id, m.kind, m.text, m.file_url, m.file_name, m.duration_sec, m.encrypted_payload, m.encryption_meta,
			m.reply_to_message_id, m.edited_at, m.deleted_at, m.created_at,
			u.id, u.name, u.username, u.email, u.bio, u.avatar_url, u.public_key, u.created_at
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		WHERE m.chat_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2
	`, chatID, limit)
	if err != nil {
		return ChatDetails{}, nil, err
	}
	defer rows.Close()

	var items []Message
	for rows.Next() {
		var msg Message
		if err := rows.Scan(
			&msg.ID, &msg.ChatID, &msg.SenderID, &msg.Kind, &msg.Text, &msg.FileURL, &msg.FileName, &msg.DurationSec, &msg.EncryptedPayload, &msg.EncryptionMeta,
			&msg.ReplyToMessage, &msg.EditedAt, &msg.DeletedAt, &msg.CreatedAt,
			&msg.Sender.ID, &msg.Sender.Name, &msg.Sender.Username, &msg.Sender.Email, &msg.Sender.Bio, &msg.Sender.AvatarURL, &msg.Sender.PublicKey, &msg.Sender.CreatedAt,
		); err != nil {
			return ChatDetails{}, nil, err
		}
		msg.Status = statusForMessage(msg.SenderID, currentUserID, msg.ID, peerLastRead)
		items = append(items, msg)
	}
	if err := rows.Err(); err != nil {
		return ChatDetails{}, nil, err
	}

	reverseMessages(items)
	return chat, items, nil
}

func (s *Store) CreateMessage(ctx context.Context, input NewMessage) (Message, []int64, error) {
	if err := s.ValidateNewMessage(ctx, input); err != nil {
		return Message{}, nil, err
	}

	recipientIDs, err := s.GetRecipientIDs(ctx, input.SenderID, input.ChatID)
	if err != nil {
		return Message{}, nil, err
	}

	var msg Message
	err = s.db.QueryRow(ctx, `
		INSERT INTO messages (chat_id, sender_id, kind, text, file_url, file_name, duration_sec, encrypted_payload, encryption_meta, reply_to_message_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, chat_id, sender_id, kind, text, file_url, file_name, duration_sec, encrypted_payload, encryption_meta, reply_to_message_id, edited_at, deleted_at, created_at
	`, input.ChatID, input.SenderID, input.Kind, input.Text, input.FileURL, input.FileName, input.DurationSec, input.EncryptedPayload, input.EncryptionMeta, input.ReplyToMessageID).
		Scan(&msg.ID, &msg.ChatID, &msg.SenderID, &msg.Kind, &msg.Text, &msg.FileURL, &msg.FileName, &msg.DurationSec, &msg.EncryptedPayload, &msg.EncryptionMeta, &msg.ReplyToMessage, &msg.EditedAt, &msg.DeletedAt, &msg.CreatedAt)
	if err != nil {
		return Message{}, nil, err
	}

	if _, err := s.db.Exec(ctx, `UPDATE chats SET updated_at = NOW() WHERE id = $1`, input.ChatID); err != nil {
		return Message{}, nil, err
	}

	user, err := s.GetUserByID(ctx, input.SenderID)
	if err != nil {
		return Message{}, nil, err
	}
	msg.Sender = user
	msg.Status = "sent"
	return msg, recipientIDs, nil
}

func (s *Store) ValidateNewMessage(ctx context.Context, input NewMessage) error {
	if input.ChatID <= 0 || input.SenderID <= 0 {
		return ErrForbidden
	}

	switch input.Kind {
	case "text":
		if strings.TrimSpace(input.Text) == "" && strings.TrimSpace(input.EncryptedPayload) == "" {
			return fmt.Errorf("message text is required")
		}
	case "image", "video", "file", "voice":
		if strings.TrimSpace(input.FileURL) == "" {
			return fmt.Errorf("message file is required")
		}
	default:
		return fmt.Errorf("unsupported message kind")
	}

	if strings.TrimSpace(input.EncryptedPayload) != "" && strings.TrimSpace(input.EncryptionMeta) == "" {
		return fmt.Errorf("message encryption metadata is required")
	}

	if input.ReplyToMessageID != nil {
		var replyChatID int64
		if err := s.db.QueryRow(ctx, `
			SELECT chat_id FROM messages WHERE id = $1
		`, *input.ReplyToMessageID).Scan(&replyChatID); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return ErrNotFound
			}
			return err
		}
		if replyChatID != input.ChatID {
			return ErrForbidden
		}
	}

	return nil
}

func (s *Store) EditMessage(ctx context.Context, currentUserID, messageID int64, text, encryptedPayload, encryptionMeta string) (Message, []int64, error) {
	var chatID int64
	err := s.db.QueryRow(ctx, `
		SELECT chat_id
		FROM messages
		WHERE id = $1 AND sender_id = $2 AND kind = 'text' AND deleted_at IS NULL
	`, messageID, currentUserID).Scan(&chatID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, nil, ErrNotFound
		}
		return Message{}, nil, err
	}

	if _, err := s.db.Exec(ctx, `
		UPDATE messages
		SET text = $2, encrypted_payload = $3, encryption_meta = $4, edited_at = NOW()
		WHERE id = $1
	`, messageID, strings.TrimSpace(text), strings.TrimSpace(encryptedPayload), strings.TrimSpace(encryptionMeta)); err != nil {
		return Message{}, nil, err
	}

	recipientIDs, err := s.GetRecipientIDs(ctx, currentUserID, chatID)
	if err != nil {
		return Message{}, nil, err
	}
	msg, err := s.GetMessageByID(ctx, currentUserID, messageID)
	return msg, recipientIDs, err
}

func (s *Store) DeleteMessage(ctx context.Context, currentUserID, messageID int64) (Message, []int64, error) {
	var chatID int64
	err := s.db.QueryRow(ctx, `
		SELECT chat_id
		FROM messages
		WHERE id = $1 AND sender_id = $2 AND deleted_at IS NULL
	`, messageID, currentUserID).Scan(&chatID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, nil, ErrNotFound
		}
		return Message{}, nil, err
	}

	if _, err := s.db.Exec(ctx, `
		UPDATE messages
		SET text = '', file_url = '', file_name = '', duration_sec = 0, encrypted_payload = '', encryption_meta = '', deleted_at = NOW()
		WHERE id = $1
	`, messageID); err != nil {
		return Message{}, nil, err
	}

	recipientIDs, err := s.GetRecipientIDs(ctx, currentUserID, chatID)
	if err != nil {
		return Message{}, nil, err
	}
	msg, err := s.GetMessageByID(ctx, currentUserID, messageID)
	return msg, recipientIDs, err
}

func (s *Store) GetMessageByID(ctx context.Context, currentUserID, messageID int64) (Message, error) {
	var msg Message
	var peerLastRead int64

	err := s.db.QueryRow(ctx, `
		SELECT
			m.id, m.chat_id, m.sender_id, m.kind, m.text, m.file_url, m.file_name, m.duration_sec, m.encrypted_payload, m.encryption_meta,
			m.reply_to_message_id, m.edited_at, m.deleted_at, m.created_at,
			u.id, u.name, u.username, u.email, u.bio, u.avatar_url, u.public_key, u.created_at,
			COALESCE((
				SELECT MIN(COALESCE(cp.last_read_message_id, 0))
				FROM chat_participants cp
				WHERE cp.chat_id = m.chat_id AND cp.user_id <> $1
			), 0)
		FROM messages m
		JOIN users u ON u.id = m.sender_id
		JOIN chat_participants self ON self.chat_id = m.chat_id AND self.user_id = $1
		WHERE m.id = $2
	`, currentUserID, messageID).Scan(
		&msg.ID, &msg.ChatID, &msg.SenderID, &msg.Kind, &msg.Text, &msg.FileURL, &msg.FileName, &msg.DurationSec, &msg.EncryptedPayload, &msg.EncryptionMeta,
		&msg.ReplyToMessage, &msg.EditedAt, &msg.DeletedAt, &msg.CreatedAt,
		&msg.Sender.ID, &msg.Sender.Name, &msg.Sender.Username, &msg.Sender.Email, &msg.Sender.Bio, &msg.Sender.AvatarURL, &msg.Sender.PublicKey, &msg.Sender.CreatedAt,
		&peerLastRead,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Message{}, ErrNotFound
		}
		return Message{}, err
	}
	msg.Status = statusForMessage(msg.SenderID, currentUserID, msg.ID, peerLastRead)
	return msg, nil
}

func (s *Store) MarkChatRead(ctx context.Context, currentUserID, chatID int64) ([]int64, error) {
	var lastMessageID int64
	if err := s.db.QueryRow(ctx, `
		SELECT COALESCE(MAX(id), 0) FROM messages WHERE chat_id = $1
	`, chatID).Scan(&lastMessageID); err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(ctx, `
		UPDATE chat_participants
		SET last_read_message_id = $3
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, currentUserID, lastMessageID); err != nil {
		return nil, err
	}
	return s.GetRecipientIDs(ctx, currentUserID, chatID)
}

func (s *Store) GetRecipientIDs(ctx context.Context, currentUserID, chatID int64) ([]int64, error) {
	rows, err := s.db.Query(ctx, `
		SELECT other.user_id
		FROM chat_participants self
		JOIN chat_participants other ON other.chat_id = self.chat_id AND other.user_id <> $2
		WHERE self.chat_id = $1 AND self.user_id = $2
	`, chatID, currentUserID)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return nil, ErrNotFound
	}
	return ids, nil
}

func statusForMessage(senderID, currentUserID, messageID, peerLastRead int64) string {
	if senderID != currentUserID {
		return "received"
	}
	if peerLastRead >= messageID {
		return "read"
	}
	return "sent"
}

func peerForChat(chat ChatDetails, currentUserID int64) User {
	if chat.Kind == "group" {
		return User{
			ID:        0,
			Name:      chat.Title,
			Username:  fmt.Sprintf("%d participants", len(chat.Participants)),
			AvatarURL: chat.AvatarURL,
		}
	}
	for _, user := range chat.Participants {
		if user.ID != currentUserID {
			return user
		}
	}
	return User{}
}

func peerForPreview(chat ChatPreview, currentUserID int64) User {
	if chat.Kind == "group" {
		return User{
			ID:        0,
			Name:      chat.Title,
			Username:  fmt.Sprintf("%d participants", len(chat.Participants)),
			AvatarURL: chat.AvatarURL,
		}
	}
	for _, user := range chat.Participants {
		if user.ID != currentUserID {
			return user
		}
	}
	return User{}
}

func reverseMessages(items []Message) {
	for left, right := 0, len(items)-1; left < right; left, right = left+1, right-1 {
		items[left], items[right] = items[right], items[left]
	}
}

func derefInt64(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

func derefInt(v *int) int {
	if v == nil {
		return 0
	}
	return *v
}

func derefString(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func derefTime(v *time.Time) time.Time {
	if v == nil {
		return time.Time{}
	}
	return *v
}

func ValidateRegistration(input Credentials) error {
	if strings.TrimSpace(input.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if strings.TrimSpace(input.Username) == "" {
		return fmt.Errorf("username is required")
	}
	if strings.TrimSpace(input.Email) == "" {
		return fmt.Errorf("email is required")
	}
	if len(strings.TrimSpace(input.Password)) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}
	return nil
}
