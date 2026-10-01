-- Название версии и история правок. Версию можно менять и после публикации:
-- каждое сохранение оставляет комментарий, автора и снимок параметров.

ALTER TABLE basket_versions
    ADD COLUMN IF NOT EXISTS name VARCHAR(255) NOT NULL DEFAULT '';

UPDATE basket_versions
SET name = 'Версия ' || version_no::text
WHERE btrim(name) = '';

CREATE TABLE IF NOT EXISTS basket_version_changes (
    id SERIAL PRIMARY KEY,
    version_id INTEGER NOT NULL REFERENCES basket_versions (id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    author VARCHAR(255) NOT NULL DEFAULT '',
    name VARCHAR(255) NOT NULL,
    settings JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS basket_version_changes_version_idx
    ON basket_version_changes (version_id, created_at DESC);
