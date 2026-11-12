-- Кассовые операции. Внешних ключей нет, день может повторяться.
-- Вид запуска kassa и вклад кассы в авторов общей премии.
-- Повторный запуск не пересоздаёт таблицу и не сужает уже разрешённые виды.

CREATE TABLE IF NOT EXISTS raw.kassa_oper (
    "period" TIMESTAMP NULL,
    "date" TIMESTAMP NULL,
    "Фирма" TEXT NULL,
    author TEXT NULL,
    "minute" INT8 NULL,
    CONSTRAINT kassa_oper_period_month CHECK ("period" IS NULL OR "period" = date_trunc('month', "period"))
);

COMMENT ON TABLE raw.kassa_oper IS
    'Минуты кассовых операций автора за день. Филиал документа — «Фирма». В премию филиал берётся из штатного расписания на дату документа.';

COMMENT ON COLUMN raw.kassa_oper."period" IS
    'Месяц, первое число, полночь.';

COMMENT ON COLUMN raw.kassa_oper."date" IS
    'Дата документа.';

COMMENT ON COLUMN raw.kassa_oper."Фирма" IS
    'Филиал документа. Для автокассы и терминала это филиал премии. Для сотрудника филиал берётся из штатного расписания.';

COMMENT ON COLUMN raw.kassa_oper.author IS
    'Автор операции, uuid текстом.';

COMMENT ON COLUMN raw.kassa_oper."minute" IS
    'Минуты операции. Премия — минуты, умноженные на тариф территории и коэффициент филиала.';

CREATE INDEX IF NOT EXISTS kassa_oper_period_author_idx
    ON raw.kassa_oper ("period", lower(btrim(author::text)));

COMMENT ON INDEX raw.kassa_oper_period_author_idx IS
    'Кассовые операции сотрудника за месяц.';

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_kind_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_kind_check
    CHECK (basket_kind IN ('sale', 'release', 'kassa', 'shared'));

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale — продажа товара, release — выдача товара, kassa — кассовые операции, shared — общая премия.';

ALTER TABLE main.shared_premium_authors
    ADD COLUMN IF NOT EXISTS kassa NUMERIC(18, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN main.shared_premium_authors.kassa IS
    'Премия за кассовые операции, которая вошла во вклад филиала.';

COMMENT ON TABLE main.shared_premium_authors IS
    'Вклад автора в общую премию филиала за месяц: продажа, выдача и касса отдельно. Пишется вместе с распределением долей.';
