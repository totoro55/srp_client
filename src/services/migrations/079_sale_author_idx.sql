-- Детализация сотрудника ищет его продажи за месяц, а не все строки периода.
-- Повторный запуск не пересоздаёт индексы.

CREATE INDEX IF NOT EXISTS sale_period_author_idx
    ON raw.sale (period, lower(btrim(author)));

CREATE INDEX IF NOT EXISTS sale_period_author2_idx
    ON raw.sale (period, lower(btrim(author2)))
    WHERE author2 IS NOT NULL AND btrim(author2) <> '';

COMMENT ON INDEX raw.sale_period_author_idx IS
    'Продажи сотрудника за месяц по автору документа.';

COMMENT ON INDEX raw.sale_period_author2_idx IS
    'Продажи сотрудника за месяц по второму автору, если документ оформил интернет-магазин.';
