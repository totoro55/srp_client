-- Набор товара: сырые строки, вид пересчёта и вклад в общую премию.

CREATE TABLE IF NOT EXISTS raw.product_selection (
    "period" DATE NULL,
    branch_uuid UUID NULL,
    author UUID NULL,
    "date" DATE NULL,
    type_nabor TEXT NULL,
    count_tovar FLOAT8 NULL,
    volume FLOAT8 NULL,
    CONSTRAINT product_selection_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period")::date)
);

COMMENT ON TABLE raw.product_selection IS
    'Набор товара. count_tovar — количество, volume — объём м³, type_nabor — вид набора. Филиал премии берётся из штатного расписания.';

COMMENT ON COLUMN raw.product_selection."period" IS 'Месяц, первое число.';
COMMENT ON COLUMN raw.product_selection.branch_uuid IS 'Филиал документа. Для системной учётки это филиал премии.';
COMMENT ON COLUMN raw.product_selection.author IS 'Автор набора.';
COMMENT ON COLUMN raw.product_selection."date" IS 'Дата набора.';
COMMENT ON COLUMN raw.product_selection.type_nabor IS 'Вид набора.';
COMMENT ON COLUMN raw.product_selection.count_tovar IS 'Количество набранного товара.';
COMMENT ON COLUMN raw.product_selection.volume IS 'Объём набранного товара, м³.';

CREATE INDEX IF NOT EXISTS product_selection_period_author_idx
    ON raw.product_selection ("period", author);

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_kind_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_kind_check
    CHECK (basket_kind IN ('sale', 'release', 'kassa', 'osnt', 'warehouse', 'unloading', 'selection', 'shared', 'tariffs', 'brigade'));

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale, release, kassa, osnt, warehouse, unloading, selection — корзины; shared — общая премия; tariffs — тарифы продаж; brigade — доли бригады.';

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
        'Набор товара'
    ));

ALTER TABLE main.shared_premium_authors
    ADD COLUMN IF NOT EXISTS selection NUMERIC(18, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN main.shared_premium_authors.selection IS
    'Премия за набор товара, которая вошла во вклад филиала.';

COMMENT ON TABLE main.shared_premium_authors IS
    'Вклад автора в общую премию филиала за месяц: продажа, выдача, касса, ОСНТ, склад, разгрузка и набор отдельно.';
