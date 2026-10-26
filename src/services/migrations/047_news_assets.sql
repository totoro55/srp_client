CREATE TABLE IF NOT EXISTS news_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id INTEGER REFERENCES news_posts (id) ON DELETE CASCADE,
    mime VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content BYTEA NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE news_assets IS
    'Снимок или вложение новости. Читатель видит файл только из доступной опубликованной новости.';
