ALTER TABLE feedback_tickets
    ADD COLUMN IF NOT EXISTS kind VARCHAR(32);

ALTER TABLE feedback_tickets
    ADD COLUMN IF NOT EXISTS article_id INTEGER REFERENCES wiki_articles (id) ON DELETE SET NULL;

ALTER TABLE feedback_tickets
    ADD COLUMN IF NOT EXISTS document_title VARCHAR(300);

ALTER TABLE feedback_tickets
    DROP CONSTRAINT IF EXISTS feedback_tickets_kind_check;

ALTER TABLE feedback_tickets
    ADD CONSTRAINT feedback_tickets_kind_check
        CHECK (kind IS NULL OR kind IN ('question', 'error', 'suggestion', 'wiki'));

COMMENT ON COLUMN feedback_tickets.kind IS
    'Вид обращения: question — вопрос, error — ошибка, suggestion — предложение, wiki — база знаний. Пусто у обращений, созданных до этого поля.';

COMMENT ON COLUMN feedback_tickets.article_id IS
    'Статья, по которой создано обращение. Пусто, если обращение создано из общей формы или статья удалена.';

COMMENT ON COLUMN feedback_tickets.document_title IS
    'Название связанного документа на момент создания. Остаётся, если статья удалена.';

CREATE INDEX IF NOT EXISTS feedback_tickets_article_idx
    ON feedback_tickets (article_id)
    WHERE article_id IS NOT NULL;
