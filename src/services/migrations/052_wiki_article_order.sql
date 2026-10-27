ALTER TABLE wiki_articles
    ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN wiki_articles.sort_order IS
    'Порядок статьи среди статей той же группы. Меньшее значение показывается выше.';
