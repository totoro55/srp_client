-- Выставление товара: сырые строки, вид пересчёта и вклад в общую премию.
-- Таблицу может заранее положить выгрузка. Повторный запуск её не пересоздаёт.

CREATE TABLE IF NOT EXISTS raw.vystavleniye (
    "date" TIMESTAMP NULL,
    branch_uuid UUID NULL,
    author UUID NULL,
    "zone" TEXT NULL,
    count FLOAT8 NULL,
    volume FLOAT8 NULL,
    "period" TIMESTAMP NULL,
    CONSTRAINT vystavleniye_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period"))
);

COMMENT ON TABLE raw.vystavleniye IS
    'Выставление товара. count и volume — итог зоны за день на филиале документа, строка повторяется на каждого сотрудника зоны. Филиал премии берётся из штатного расписания.';

COMMENT ON COLUMN raw.vystavleniye."date" IS 'День выставления.';
COMMENT ON COLUMN raw.vystavleniye.branch_uuid IS 'Филиал документа.';
COMMENT ON COLUMN raw.vystavleniye.author IS 'Сотрудник, привязанный к зоне. Нулевой uuid — выставление без автора.';
COMMENT ON COLUMN raw.vystavleniye."zone" IS 'Зона. «Без зоны» — выставление, не привязанное к зоне.';
COMMENT ON COLUMN raw.vystavleniye.count IS 'Количество по зоне за день, одно и то же в каждой строке зоны.';
COMMENT ON COLUMN raw.vystavleniye.volume IS 'Объём по зоне за день, м³, одно и то же в каждой строке зоны.';
COMMENT ON COLUMN raw.vystavleniye."period" IS 'Месяц, первое число, полночь.';

CREATE INDEX IF NOT EXISTS vystavleniye_period_branch_date_idx
    ON raw.vystavleniye ("period", branch_uuid, (("date")::date));

CREATE INDEX IF NOT EXISTS vystavleniye_period_author_idx
    ON raw.vystavleniye ("period", author);

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_kind_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_kind_check
    CHECK (basket_kind IN ('sale', 'release', 'kassa', 'osnt', 'warehouse', 'unloading', 'selection', 'display', 'shared', 'tariffs', 'brigade'));

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale, release, kassa, osnt, warehouse, unloading, selection, display — корзины; shared — общая премия; tariffs — тарифы продаж; brigade — доли бригады.';

ALTER TABLE main.brigade_premium_shares
    DROP CONSTRAINT IF EXISTS brigade_premium_shares_indicator_check;

ALTER TABLE main.brigade_premium_shares
    ADD CONSTRAINT brigade_premium_shares_indicator_check
    CHECK (indicator IN (
        'Продажа товара',
        'Выдача товара',
        'Кассовые операции',
        'ОСНТ',
        'Складские операции',
        'Разгрузка ТС',
        'Набор товара',
        'Выставление товара'
    ));

ALTER TABLE main.shared_premium_authors
    ADD COLUMN IF NOT EXISTS display NUMERIC(18, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN main.shared_premium_authors.display IS
    'Премия за выставление товара, которая вошла во вклад филиала.';

COMMENT ON TABLE main.shared_premium_authors IS
    'Вклад автора в общую премию филиала за месяц: продажа, выдача, касса, ОСНТ, склад, разгрузка, набор и выставление отдельно.';
