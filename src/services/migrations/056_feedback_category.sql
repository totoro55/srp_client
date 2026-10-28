ALTER TABLE feedback_tickets
    ADD COLUMN IF NOT EXISTS category VARCHAR(32);

ALTER TABLE feedback_tickets
    DROP CONSTRAINT IF EXISTS feedback_tickets_kind_check;

UPDATE feedback_tickets
SET category = 'wiki'
WHERE category IS NULL
  AND (kind = 'wiki' OR article_id IS NOT NULL);

UPDATE feedback_tickets
SET kind = 'problem'
WHERE kind = 'error';

UPDATE feedback_tickets
SET kind = NULL
WHERE kind = 'wiki';

ALTER TABLE feedback_tickets
    DROP CONSTRAINT IF EXISTS feedback_tickets_kind_check;

ALTER TABLE feedback_tickets
    ADD CONSTRAINT feedback_tickets_kind_check
        CHECK (kind IS NULL OR kind IN ('problem', 'question', 'suggestion'));

ALTER TABLE feedback_tickets
    DROP CONSTRAINT IF EXISTS feedback_tickets_category_check;

ALTER TABLE feedback_tickets
    ADD CONSTRAINT feedback_tickets_category_check
        CHECK (category IS NULL OR category IN ('wiki', 'news', 'bonus', 'rrs', 'baskets', 'tariffs', 'other'));

COMMENT ON COLUMN feedback_tickets.kind IS
    'Вид обращения: problem — проблема, question — вопрос, suggestion — предложение. Пусто у старых обращений.';

COMMENT ON COLUMN feedback_tickets.category IS
    'Категория: wiki, news, bonus, rrs, baskets, tariffs или other. Пусто у обращений, созданных до этого поля.';
