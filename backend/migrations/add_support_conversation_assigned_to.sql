-- Миграция: добавить поле assigned_to_user_id в support_conversations
-- Применить: psql $DATABASE_URL -f this_file.sql

ALTER TABLE support_conversations
    ADD COLUMN IF NOT EXISTS assigned_to_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

-- Индекс для быстрого поиска по назначенному оператору
CREATE INDEX IF NOT EXISTS idx_support_conversations_assigned_to
    ON support_conversations(assigned_to_user_id);
