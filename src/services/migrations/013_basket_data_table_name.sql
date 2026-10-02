-- Имя таблицы подключения — код корзины и номер версии, например sales_v2.
-- Одинаковый номер версии у разных корзин больше не даёт одно и то же имя.
-- Уже созданные таблицы v_<id> переименовываются.

ALTER TABLE basket_versions DROP CONSTRAINT IF EXISTS basket_versions_data_table_check;

DO $$
DECLARE
    rec record;
    new_name text;
    old_log text;
    new_log text;
BEGIN
    FOR rec IN
        SELECT v.id, v.version_no, v.data_table, b.code
        FROM basket_versions v
        JOIN baskets b ON b.id = v.basket_id
        WHERE v.data_table IS NOT NULL
          AND v.data_table IS DISTINCT FROM (b.code || '_v' || v.version_no::text)
    LOOP
        new_name := rec.code || '_v' || rec.version_no::text;
        new_log := new_name || '_log';
        IF char_length(new_log) > 63 THEN
            RAISE EXCEPTION 'Код корзины % слишком длинный для имени таблицы подключения', rec.code;
        END IF;
        old_log := rec.data_table || '_log';
        IF to_regclass(format('basket_data.%I', rec.data_table)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE basket_data.%I RENAME TO %I', rec.data_table, new_name);
        END IF;
        IF to_regclass(format('basket_data.%I', old_log)) IS NOT NULL THEN
            EXECUTE format('ALTER TABLE basket_data.%I RENAME TO %I', old_log, new_log);
        END IF;
        UPDATE basket_versions SET data_table = new_name WHERE id = rec.id;
    END LOOP;
END $$;

ALTER TABLE basket_versions
    ADD CONSTRAINT basket_versions_data_table_check
    CHECK (data_table IS NULL OR data_table ~ '^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$');

COMMENT ON COLUMN basket_versions.data_table IS
    'Имя таблицы в схеме basket_data: код корзины и номер версии, например sales_v2. Пусто, пока версия не опубликована как тестовая или рабочая.';
