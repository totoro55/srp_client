-- Безнал в снимке считается построчно: base_mode per_line.
-- Повторный запуск не падает.

ALTER TABLE main.sale_premium_lines DROP CONSTRAINT IF EXISTS sale_premium_lines_mode_check;
ALTER TABLE main.sale_premium_lines
    ADD CONSTRAINT sale_premium_lines_mode_check
    CHECK (base_mode IN ('percent', 'per_unit', 'per_line'));

COMMENT ON COLUMN main.sale_premium_lines.base_mode IS
    'percent — розница от цены, per_unit — от количества, per_line — безнал, один раз на строку.';

COMMENT ON COLUMN main.sale_premium_lines.tariff IS
    'Готовый тариф строки. Ставка канала уже умножена на коэффициент канала, на 2 для розничного тарифа от количества при цене от 100 000 и на коэффициент продаж филиала.';

COMMENT ON COLUMN main.sale_premium_lines.premium IS
    'Премия строки, округление до копеек. Безнал: готовый тариф один раз на строку. Тариф от количества: готовый тариф × количество. Тариф от цены: готовый тариф × цена × количество. Множитель 2 только у розницы.';
