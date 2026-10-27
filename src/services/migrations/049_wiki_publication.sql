ALTER TABLE wiki_articles
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'published';

ALTER TABLE wiki_articles
    DROP CONSTRAINT IF EXISTS wiki_articles_status_check;

ALTER TABLE wiki_articles
    ADD CONSTRAINT wiki_articles_status_check CHECK (status IN ('draft', 'published'));

ALTER TABLE wiki_articles
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

UPDATE wiki_articles
SET published_at = updated_at
WHERE published_at IS NULL;

ALTER TABLE wiki_articles
    ALTER COLUMN published_at SET DEFAULT NOW();

ALTER TABLE wiki_articles
    ALTER COLUMN published_at SET NOT NULL;

COMMENT ON COLUMN wiki_articles.status IS
    'draft — черновик, виден только редакторам. published — статья для выбранных ролей.';

COMMENT ON COLUMN wiki_articles.published_at IS
    'Момент, с которого опубликованная статья видна читателям.';
