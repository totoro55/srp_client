ALTER TABLE news_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE news_assets ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE news_assets ALTER COLUMN content DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS news_assets_storage_key_idx ON news_assets (storage_key) WHERE storage_key IS NOT NULL;

ALTER TABLE wiki_assets ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE wiki_assets ADD COLUMN IF NOT EXISTS size_bytes INTEGER;
ALTER TABLE wiki_assets ALTER COLUMN content DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS wiki_assets_storage_key_idx ON wiki_assets (storage_key) WHERE storage_key IS NOT NULL;

COMMENT ON COLUMN news_assets.storage_key IS
    'Ключ объекта в хранилище вложений. Содержимое файла в таблице не хранится.';
COMMENT ON COLUMN wiki_assets.storage_key IS
    'Ключ объекта в хранилище вложений. Содержимое файла в таблице не хранится.';
