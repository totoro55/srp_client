ALTER TABLE feedback_tickets
    ADD COLUMN IF NOT EXISTS assignee VARCHAR(255);

COMMENT ON COLUMN feedback_tickets.assignee IS
    'Логин сотрудника, ответственного за обработку обращения.';

CREATE INDEX IF NOT EXISTS feedback_tickets_assignee_idx
    ON feedback_tickets (lower(assignee))
    WHERE assignee IS NOT NULL;
