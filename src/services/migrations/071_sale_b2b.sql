-- Вместо типа контрагента хранится признак безнала.
-- Истина только у двух контрагентов. Остальные строки, включая пустой тип, — ложь.
-- Повторный запуск не трогает столбец, если замена уже сделана.

ALTER TABLE raw.sale ADD COLUMN IF NOT EXISTS b2b BOOLEAN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'raw'
          AND table_name = 'sale'
          AND column_name = 'contragent_type'
    ) THEN
        EXECUTE $update$
            UPDATE raw.sale
            SET b2b = COALESCE(
                lower(btrim(contragent_type)) IN (
                    '462d4d24-7fe3-401a-a24c-6f595156845b',
                    '1e8123a5-c7b3-4496-b49d-5efe3ed05c8b'
                ),
                FALSE
            )
        $update$;
        ALTER TABLE raw.sale DROP COLUMN contragent_type;
    END IF;
END $$;

COMMENT ON COLUMN raw.sale.b2b IS
    'Безнал. Истина для контрагентов 462d4d24-7fe3-401a-a24c-6f595156845b и 1e8123a5-c7b3-4496-b49d-5efe3ed05c8b, иначе ложь.';
