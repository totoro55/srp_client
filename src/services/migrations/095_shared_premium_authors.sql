-- Авторы вклада в общую премию: сотрудник вне расчёта, промоутер или системная учётка.
-- Кабинет эту таблицу не читает. Её открывает страница общей премии.
-- Детализация автора считается отдельно, когда её открывают.

CREATE TABLE IF NOT EXISTS main.shared_premium_authors (
    period DATE NOT NULL,
    branch_uuid UUID NOT NULL,
    employee_uuid TEXT NOT NULL,
    author_kind TEXT NOT NULL,
    active_from DATE NOT NULL,
    sale NUMERIC(18, 2) NOT NULL,
    release NUMERIC(18, 2) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (period, branch_uuid, employee_uuid, author_kind, active_from),
    CONSTRAINT shared_premium_authors_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT shared_premium_authors_kind CHECK (author_kind IN ('staff', 'promoter', 'system'))
);

COMMENT ON TABLE main.shared_premium_authors IS
    'Вклад автора в общую премию филиала за месяц: продажа и выдача отдельно. Пишется вместе с распределением долей.';

COMMENT ON COLUMN main.shared_premium_authors.employee_uuid IS
    'Автор. Текст в нижнем регистре, как в расчёте премии.';

COMMENT ON COLUMN main.shared_premium_authors.author_kind IS
    'staff — сотрудник вне расчёта, promoter — промоутер, system — автокасса или терминал.';

COMMENT ON COLUMN main.shared_premium_authors.active_from IS
    'Начало отрезка штатного расписания. У промоутера и системной учётки — первое число месяца.';

COMMENT ON COLUMN main.shared_premium_authors.sale IS
    'Премия за продажу, которая вошла во вклад филиала.';

COMMENT ON COLUMN main.shared_premium_authors.release IS
    'Премия за выдачу, которая вошла во вклад филиала.';
