-- Выгрузка хранит автора, категорию, вид, бренд и филиал штатного расписания текстом.
-- На уже созданной таблице эти колонки могли остаться uuid: CREATE TABLE IF NOT EXISTS их не меняет.
-- firm_uuid, графики и промоутеры в выгрузке uuid, их не трогаем.
-- Повторный запуск ничего не меняет: перевод выполняется только с uuid.

DO $$
DECLARE
    target record;
    dependent record;
BEGIN
    FOR target IN
        SELECT wanted.table_name, wanted.column_name
        FROM (VALUES
            ('sale', 'author'),
            ('sale', 'author2'),
            ('sale', 'kinde'),
            ('sale', 'category'),
            ('sale', 'brend'),
            ('sale', 'link_doc'),
            ('sale', 'document_number'),
            ('sale', 'name_product'),
            ('sale', 'type_document'),
            ('hr_ktu', 'employees_uuid'),
            ('hr_ktu', 'branch_uuid'),
            ('hr_ktu', 'title'),
            ('hr_ktu', 'status'),
            ('kassa_oper', 'author'),
            ('kassa_oper', 'Фирма')
        ) AS wanted(table_name, column_name)
        JOIN information_schema.columns live
            ON live.table_schema = 'raw'
           AND live.table_name = wanted.table_name
           AND live.column_name = wanted.column_name
           AND live.udt_name = 'uuid'
    LOOP
        FOR dependent IN
            SELECT c.relname AS index_name
            FROM pg_index i
            JOIN pg_class t ON t.oid = i.indrelid
            JOIN pg_class c ON c.oid = i.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'raw'
              AND t.relname = target.table_name
              AND i.indexprs IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1
                  FROM pg_constraint constraint_row
                  WHERE constraint_row.conindid = i.indexrelid
              )
              AND pg_get_indexdef(i.indexrelid) ILIKE '%' || target.column_name || '%'
        LOOP
            EXECUTE format('DROP INDEX IF EXISTS raw.%I', dependent.index_name);
        END LOOP;

        EXECUTE format(
            'ALTER TABLE raw.%I ALTER COLUMN %I TYPE text USING %I::text',
            target.table_name,
            target.column_name,
            target.column_name
        );
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS hr_ktu_employee_modified_idx
    ON raw.hr_ktu (lower(employees_uuid::text), date_modified DESC);

CREATE INDEX IF NOT EXISTS sale_period_author_idx
    ON raw.sale (period, lower(btrim(author::text)));

CREATE INDEX IF NOT EXISTS sale_period_author2_idx
    ON raw.sale (period, lower(btrim(author2::text)))
    WHERE author2 IS NOT NULL AND btrim(author2::text) <> '';

CREATE INDEX IF NOT EXISTS kassa_oper_period_author_idx
    ON raw.kassa_oper ("period", lower(btrim(author::text)));
