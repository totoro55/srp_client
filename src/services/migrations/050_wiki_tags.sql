CREATE TABLE IF NOT EXISTS wiki_article_tags (
    article_id INTEGER NOT NULL REFERENCES wiki_articles (id) ON DELETE CASCADE,
    tag VARCHAR(32) NOT NULL,
    PRIMARY KEY (article_id, tag)
);

CREATE INDEX IF NOT EXISTS wiki_article_tags_tag_idx ON wiki_article_tags (lower(tag));

COMMENT ON TABLE wiki_article_tags IS
    'Метка статьи. По ней статью можно найти и отфильтровать.';
