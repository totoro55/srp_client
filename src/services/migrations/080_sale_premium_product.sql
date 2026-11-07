-- Название товара в снимке премии за продажу.
-- Берётся из raw.sale в момент пересчёта и остаётся, если сырые продажи уберут.
-- Повторный запуск не добавляет столбец второй раз.

ALTER TABLE main.sale_premium_lines
    ADD COLUMN IF NOT EXISTS product_name TEXT;

COMMENT ON COLUMN main.sale_premium_lines.product_name IS
    'Название товара из raw.sale. Пусто, если в продаже названия не было.';
