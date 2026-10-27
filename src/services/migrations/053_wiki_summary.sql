ALTER TABLE wiki_articles
    ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN wiki_articles.summary IS
    'Краткое содержание статьи. При публикации обязательно, у черновика может быть пустым.';
