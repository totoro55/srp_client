-- Снимки тарифов лежат рядом с параметрами версий в basket_data.
-- SET SCHEMA переносит строки, индексы и внешние ключи.
-- Повторный запуск ничего не двигает, если таблица уже в basket_data.

GRANT USAGE ON SCHEMA basket_data TO PUBLIC;

DO $$
DECLARE
    table_name text;
    source_schema text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['basket_category_tariffs', 'basket_kind_tariffs']
    LOOP
        IF to_regclass(format('basket_data.%I', table_name)) IS NOT NULL THEN
            CONTINUE;
        END IF;

        source_schema := NULL;
        IF to_regclass(format('main.%I', table_name)) IS NOT NULL THEN
            source_schema := 'main';
        ELSIF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
            source_schema := 'public';
        END IF;

        IF source_schema IS NOT NULL THEN
            EXECUTE format(
                'ALTER TABLE %I.%I SET SCHEMA basket_data',
                source_schema,
                table_name
            );
        END IF;
    END LOOP;
END $$;
