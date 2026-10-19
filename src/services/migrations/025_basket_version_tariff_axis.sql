-- Ось расчёта тарифов хранится на версии.
-- Пусто у корзин без тарифов и пока черновик продаж её не выбрал.
-- После публикации не меняется: для другой оси нужен новый черновик.

ALTER TABLE basket_versions
    ADD COLUMN IF NOT EXISTS tariff_axis VARCHAR(20);

ALTER TABLE basket_versions
    DROP CONSTRAINT IF EXISTS basket_versions_tariff_axis_check;

ALTER TABLE basket_versions
    ADD CONSTRAINT basket_versions_tariff_axis_check
    CHECK (tariff_axis IS NULL OR tariff_axis IN ('category', 'product_kind'));

COMMENT ON COLUMN basket_versions.tariff_axis IS
    'Ось тарифов корзины продаж: category или product_kind. Пусто у остальных корзин. После публикации не меняется.';
