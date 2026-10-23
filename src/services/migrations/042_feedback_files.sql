CREATE TABLE IF NOT EXISTS feedback_files (
    id UUID PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES feedback_tickets (id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES feedback_messages (id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    mime VARCHAR(150) NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT feedback_files_size_check CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS feedback_files_ticket_idx ON feedback_files (ticket_id, created_at);

COMMENT ON TABLE feedback_files IS
    'Вложение обращения. Содержимое лежит в объектном хранилище, в базе только описание и ключ.';
