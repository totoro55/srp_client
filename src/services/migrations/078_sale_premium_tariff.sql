-- Снимок премии хранит готовый тариф. Коэффициенты в строку не пишутся.
-- Уже записанный безнал: тариф умножается на свой коэффициент до удаления колонки.
-- Повторный запуск не падает.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'main'
          AND table_name = 'sale_premium_lines'
          AND column_name = 'b2b_coef'
    ) THEN
        UPDATE main.sale_premium_lines
        SET tariff = tariff * b2b_coef * sale_coef
        WHERE channel = 'b2b'
          AND (b2b_coef IS DISTINCT FROM 1 OR sale_coef IS DISTINCT FROM 1);
    END IF;
END $$;

ALTER TABLE main.sale_premium_lines DROP COLUMN IF EXISTS sale_coef;
ALTER TABLE main.sale_premium_lines DROP COLUMN IF EXISTS b2b_coef;

ALTER TABLE main.sale_premium_lines DROP CONSTRAINT IF EXISTS sale_premium_lines_channel_check;
ALTER TABLE main.sale_premium_lines
    ADD CONSTRAINT sale_premium_lines_channel_check
    CHECK (channel IN ('main', 'stm', 'not_stm', 'im', 'b2b'));

COMMENT ON TABLE main.sale_premium_lines IS
    'Строка премии за продажу. Считается по подключённой версии. Остаётся, если совсем старый период уберут из raw.sale.';

COMMENT ON COLUMN main.sale_premium_lines.channel IS
    'stm — розница СТМ, not_stm — розница не СТМ, im — интернет-магазин, b2b — безнал. main — розница в снимке, где эти каналы ещё не разделены.';

COMMENT ON COLUMN main.sale_premium_lines.tariff IS
    'Готовый тариф строки. Ставка канала уже умножена на коэффициент канала, на 2 для тарифа от количества при цене от 100 000 и на коэффициент продаж филиала.';

COMMENT ON COLUMN main.sale_premium_lines.premium IS
    'Премия строки, округление до копеек. Тариф от количества: готовый тариф × количество. Тариф от цены: готовый тариф × цена × количество.';
