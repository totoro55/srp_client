-- Пометка на удаление короче: deleted.
-- База, где миграция 039 уже создала старое имя, переименовывает столбец.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'dictionaries'
          AND table_name = 'territories'
          AND column_name = 'marked_for_deletion'
    ) THEN
        ALTER TABLE dictionaries.territories RENAME COLUMN marked_for_deletion TO deleted;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'dictionaries'
          AND table_name = 'branches'
          AND column_name = 'marked_for_deletion'
    ) THEN
        ALTER TABLE dictionaries.branches RENAME COLUMN marked_for_deletion TO deleted;
    END IF;
END $$;
