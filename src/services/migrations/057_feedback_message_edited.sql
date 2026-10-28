ALTER TABLE feedback_messages
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN feedback_messages.edited_at IS
    'Когда сообщение правили в последний раз. Пусто, если текст и вложения не меняли.';
