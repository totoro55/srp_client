-- ОСНТ, складские операции и разгрузка ТС: сырые таблицы, виды пересчёта и вклад в общую премию.

CREATE TABLE IF NOT EXISTS raw.osnt (
    "period" TIMESTAMP NULL,
    "date" TIMESTAMP NULL,
    firm_uuid UUID NULL,
    author UUID NULL,
    operation INT8 NULL,
    CONSTRAINT osnt_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period"))
);

COMMENT ON TABLE raw.osnt IS
    'Операции с неисправным товаром. operation — число документов автора за день. Филиал премии берётся из штатного расписания.';

COMMENT ON COLUMN raw.osnt."period" IS 'Месяц, первое число, полночь.';
COMMENT ON COLUMN raw.osnt."date" IS 'Дата документов.';
COMMENT ON COLUMN raw.osnt.firm_uuid IS 'Филиал документа. Для системной учётки это филиал премии.';
COMMENT ON COLUMN raw.osnt.author IS 'Автор операций.';
COMMENT ON COLUMN raw.osnt.operation IS 'Количество документов автора за день.';

CREATE INDEX IF NOT EXISTS osnt_period_author_idx
    ON raw.osnt ("period", author);

CREATE TABLE IF NOT EXISTS raw.wh_operations (
    "period" TIMESTAMP NULL,
    "date" TIMESTAMP NULL,
    firm_uuid UUID NULL,
    author UUID NULL,
    count_tovar FLOAT8 NULL,
    "values" FLOAT8 NULL,
    type_operation TEXT NULL,
    CONSTRAINT wh_operations_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period"))
);

COMMENT ON TABLE raw.wh_operations IS
    'Складские операции приёмки и отгрузки. count_tovar — количество, values — объём м³.';

COMMENT ON COLUMN raw.wh_operations.type_operation IS
    'Приемка или Отгрузка.';

CREATE INDEX IF NOT EXISTS wh_operations_period_author_idx
    ON raw.wh_operations ("period", author);

CREATE INDEX IF NOT EXISTS wh_operations_period_firm_date_idx
    ON raw.wh_operations ("period", firm_uuid, (("date")::date))
    WHERE type_operation = 'Приемка';

CREATE TABLE IF NOT EXISTS raw.unloading_car (
    "period" TIMESTAMP NULL,
    "date" TIMESTAMP NULL,
    firm_uuid UUID NULL,
    author UUID NULL,
    CONSTRAINT unloading_car_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period"))
);

COMMENT ON TABLE raw.unloading_car IS
    'Выполнение разгрузки ТС сотрудником на филиале в день.';

CREATE INDEX IF NOT EXISTS unloading_car_period_firm_date_idx
    ON raw.unloading_car ("period", firm_uuid, (("date")::date), author);

CREATE TABLE IF NOT EXISTS raw.grafik_otgruzok (
    "period" TIMESTAMP NULL,
    branch_uuid UUID NULL,
    "date" TIMESTAMP NULL,
    CONSTRAINT grafik_otgruzok_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period"))
);

COMMENT ON TABLE raw.grafik_otgruzok IS
    'График прихода ТС на филиал. День с машиной — рабочий день разгрузки.';

CREATE INDEX IF NOT EXISTS grafik_otgruzok_period_branch_date_idx
    ON raw.grafik_otgruzok ("period", branch_uuid, (("date")::date));

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_kind_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_kind_check
    CHECK (basket_kind IN ('sale', 'release', 'kassa', 'osnt', 'warehouse', 'unloading', 'shared', 'tariffs'));

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale, release, kassa, osnt, warehouse, unloading — корзины; shared — общая премия; tariffs — тарифы продаж.';

ALTER TABLE main.shared_premium_authors
    ADD COLUMN IF NOT EXISTS osnt NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE main.shared_premium_authors
    ADD COLUMN IF NOT EXISTS warehouse NUMERIC(18, 2) NOT NULL DEFAULT 0;

ALTER TABLE main.shared_premium_authors
    ADD COLUMN IF NOT EXISTS unloading NUMERIC(18, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN main.shared_premium_authors.osnt IS
    'Премия за ОСНТ, которая вошла во вклад филиала.';

COMMENT ON COLUMN main.shared_premium_authors.warehouse IS
    'Премия за складские операции, которая вошла во вклад филиала.';

COMMENT ON COLUMN main.shared_premium_authors.unloading IS
    'Премия за разгрузку ТС, которая вошла во вклад филиала.';

COMMENT ON TABLE main.shared_premium_authors IS
    'Вклад автора в общую премию филиала за месяц: продажа, выдача, касса, ОСНТ, склад и разгрузка отдельно.';
