-- Сохранение бригад пишет в журнал отдельный запуск, не снимок корзины.
-- Повторный запуск не сужает уже разрешённые виды.

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_kind_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_kind_check
    CHECK (basket_kind IN ('sale', 'release', 'kassa', 'osnt', 'warehouse', 'unloading', 'shared', 'tariffs', 'brigade'));

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale, release, kassa, osnt, warehouse, unloading — корзины; shared — общая премия; tariffs — тарифы продаж; brigade — доли бригады после сохранения состава.';
