ALTER TABLE wiki_articles
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE wiki_articles
    ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

UPDATE wiki_articles
SET created_by = updated_by
WHERE created_by IS NULL OR btrim(created_by) = '';

ALTER TABLE wiki_articles
    ALTER COLUMN created_by SET NOT NULL;

COMMENT ON COLUMN wiki_articles.archived IS
    'Статья в архиве. Опубликованная остаётся видимой и отмечена как архивная. Черновик в архиве виден только редакторам.';

COMMENT ON COLUMN wiki_articles.created_by IS
    'Учётная запись автора. Не меняется при последующих правках.';
