ALTER TABLE news_posts
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'published';

ALTER TABLE news_posts
    ADD COLUMN IF NOT EXISTS document JSONB;

ALTER TABLE news_posts
    DROP CONSTRAINT IF EXISTS news_posts_status_check;

ALTER TABLE news_posts
    ADD CONSTRAINT news_posts_status_check CHECK (status IN ('draft', 'published'));

COMMENT ON COLUMN news_posts.status IS
    'draft — черновик, виден только редакторам. published — новость для выбранных ролей.';

COMMENT ON COLUMN news_posts.document IS
    'Документ TipTap. Пусто у новостей, сохранённых обычным текстом.';
