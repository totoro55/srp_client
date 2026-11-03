CREATE TABLE IF NOT EXISTS news_reads (
    post_id INTEGER NOT NULL REFERENCES news_posts (id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (post_id, username)
);

CREATE INDEX IF NOT EXISTS news_reads_username_idx
    ON news_reads (lower(username), read_at DESC);

COMMENT ON TABLE news_reads IS
    'Прочтение новости пользователем. Логин хранится в нижнем регистре.';
