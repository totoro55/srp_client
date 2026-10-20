-- Справочники, сырьё расчёта и снимки тарифов разъезжаются по схемам.
-- SET SCHEMA переносит таблицу вместе со строками, индексами и внешними ключами.
-- Повторный запуск ничего не двигает, если таблица уже в целевой схеме.

CREATE SCHEMA IF NOT EXISTS dictionaries;
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS main;

GRANT USAGE ON SCHEMA dictionaries, raw, main TO PUBLIC;

DO $$
DECLARE
    move record;
BEGIN
    FOR move IN
        SELECT *
        FROM (VALUES
            ('territories', 'dictionaries'),
            ('branches', 'dictionaries'),
            ('employees', 'dictionaries'),
            ('product_categories', 'dictionaries'),
            ('product_kinds', 'dictionaries'),
            ('basket_category_stats', 'raw'),
            ('basket_kind_stats', 'raw'),
            ('basket_category_tariffs', 'main'),
            ('basket_kind_tariffs', 'main')
        ) AS planned (table_name, target_schema)
    LOOP
        IF to_regclass(format('public.%I', move.table_name)) IS NOT NULL
           AND to_regclass(format('%I.%I', move.target_schema, move.table_name)) IS NULL
        THEN
            EXECUTE format(
                'ALTER TABLE public.%I SET SCHEMA %I',
                move.table_name,
                move.target_schema
            );
        END IF;
    END LOOP;
END $$;
