-- Пересчёт тарифов продажи — отдельный запуск в журнале, не снимок премии.
-- Повторный запуск не сужает уже разрешённые виды.

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_kind_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_kind_check
    CHECK (basket_kind IN ('sale', 'release', 'kassa', 'shared', 'tariffs'));

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale — продажа товара, release — выдача товара, kassa — кассовые операции, shared — общая премия, tariffs — тарифы продажи.';
