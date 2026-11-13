-- Скрипт расчёта выбирается на версии.
-- Пусто: версия хранит параметры, но премию не пишет.
-- Запрос скрипта читает таблицу той версии, которая его выбрала.

ALTER TABLE basket_versions
    ADD COLUMN IF NOT EXISTS script_id VARCHAR(80);

COMMENT ON COLUMN basket_versions.script_id IS
    'Код скрипта расчёта из каталога приложения. Пусто — версия не пишет снимок премии.';

UPDATE basket_versions AS version
SET script_id = 'release.quantity-volume'
FROM baskets AS basket
JOIN indicators AS indicator ON indicator.id = basket.indicator_id
WHERE version.basket_id = basket.id
  AND indicator.name = 'Выдача товара'
  AND version.version_no = 1
  AND version.script_id IS NULL;

UPDATE basket_versions AS version
SET script_id = 'kassa.minutes'
FROM baskets AS basket
JOIN indicators AS indicator ON indicator.id = basket.indicator_id
WHERE version.basket_id = basket.id
  AND indicator.name = 'Кассовые операции'
  AND version.version_no = 1
  AND version.script_id IS NULL;

CREATE OR REPLACE FUNCTION basket_data.connection_number(
    data_table text,
    parameter text,
    territory uuid,
    month date
) RETURNS numeric
    LANGUAGE plpgsql
    STABLE
AS $$
DECLARE
    rate numeric;
BEGIN
    IF data_table IS NULL OR data_table !~ '^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$' THEN
        RAISE EXCEPTION 'У версии нет таблицы параметров';
    END IF;
    IF parameter IS NULL OR parameter !~ '^[a-z][a-z0-9_]{0,49}$' THEN
        RAISE EXCEPTION 'Скрипт запрашивает недопустимый параметр %', parameter;
    END IF;
    EXECUTE format(
        'SELECT %I
         FROM basket_data.%I
         WHERE territory_uuid = $1
           AND period <= $2
         ORDER BY period DESC
         LIMIT 1',
        parameter,
        data_table
    ) INTO rate USING territory, month;
    RETURN rate;
EXCEPTION
    WHEN undefined_table THEN
        RAISE EXCEPTION 'Таблица параметров % не найдена', data_table;
    WHEN undefined_column THEN
        RAISE EXCEPTION 'В таблице % нет параметра %', data_table, parameter;
END;
$$;

COMMENT ON FUNCTION basket_data.connection_number(text, text, uuid, date) IS
    'Числовой параметр версии на РРС. Последняя запись с периодом не позже месяца. Нет строки — пусто. Нет таблицы или колонки — ошибка.';
