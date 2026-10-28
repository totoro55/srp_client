CREATE TABLE IF NOT EXISTS app_notifications (
    id SERIAL PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    body TEXT NOT NULL,
    href VARCHAR(500) NOT NULL,
    source_key VARCHAR(200),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_notifications_recipient_idx
    ON app_notifications (lower(recipient), id DESC);

CREATE INDEX IF NOT EXISTS app_notifications_unread_idx
    ON app_notifications (lower(recipient))
    WHERE read_at IS NULL;

COMMENT ON TABLE app_notifications IS
    'Событие для конкретного человека. kind — раздел, сначала только feedback. source_key связывает событие с объектом, чтобы открытие погасило связанные записи.';

CREATE TABLE IF NOT EXISTS feedback_visits (
    ticket_id INTEGER NOT NULL REFERENCES feedback_tickets (id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    seen_message_id INTEGER NOT NULL DEFAULT 0,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (ticket_id, username)
);

COMMENT ON TABLE feedback_visits IS
    'Последнее открытие обращения. seen_message_id — последнее сообщение, которое человек уже видел. Логин хранится в нижнем регистре.';
