CREATE TABLE IF NOT EXISTS wiki_favorites (
    username VARCHAR(255) NOT NULL,
    article_id INTEGER NOT NULL REFERENCES wiki_articles (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (username, article_id)
);

COMMENT ON TABLE wiki_favorites IS
    'Избранные статьи. Список хранится отдельно для каждого пользователя.';
