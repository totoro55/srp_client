-- Ставка base из параметров корзины на РРС.
-- Её читает расчёт премии, когда категории или изделия нет в тарифах месяца.
-- Повторный запуск заменяет функцию.

CREATE OR REPLACE FUNCTION basket_data.connection_base(
    data_table text,
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
        RETURN NULL;
    END IF;
    EXECUTE format(
        'SELECT base
         FROM basket_data.%I
         WHERE territory_uuid = $1
           AND period <= $2
         ORDER BY period DESC
         LIMIT 1',
        data_table
    ) INTO rate USING territory, month;
    RETURN rate;
EXCEPTION
    WHEN undefined_table OR undefined_column THEN
        RETURN NULL;
END;
$$;

COMMENT ON FUNCTION basket_data.connection_base(text, uuid, date) IS
    'Параметр base корзины на РРС. Последняя запись с периодом не позже месяца. Нет таблицы или колонки — пусто.';
