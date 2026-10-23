CREATE INDEX IF NOT EXISTS feedback_messages_ticket_id_idx
    ON feedback_messages (ticket_id, id);
