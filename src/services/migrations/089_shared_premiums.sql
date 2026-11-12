-- Доля общей премии филиала по отрезку штатного расписания.
-- Отрезок, который пересекается с начислением зарплаты, пересчёт не меняет.

CREATE TABLE IF NOT EXISTS main.shared_premiums (
    period DATE NOT NULL,
    territory_uuid UUID NOT NULL,
    branch_uuid UUID NOT NULL,
    employee_uuid TEXT NOT NULL,
    active_from DATE NOT NULL,
    active_until DATE NOT NULL,
    premium NUMERIC(18, 2) NOT NULL,
    accrual_id BIGINT REFERENCES main.premium_accruals (id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (period, branch_uuid, employee_uuid, active_from),
    CONSTRAINT shared_premiums_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT shared_premiums_interval CHECK (active_from <= active_until)
);

COMMENT ON TABLE main.shared_premiums IS
    'Доля общей премии филиала за отрезок штатного расписания. Пересчёт не меняет отрезок, который пересекается с начислением зарплаты.';

COMMENT ON COLUMN main.shared_premiums.employee_uuid IS
    'Сотрудник. Текст в нижнем регистре, как в расчёте премии.';

COMMENT ON COLUMN main.shared_premiums.active_from IS
    'Первый день отрезка штатного расписания внутри месяца.';

COMMENT ON COLUMN main.shared_premiums.active_until IS
    'Последний день отрезка штатного расписания внутри месяца.';

COMMENT ON COLUMN main.shared_premiums.premium IS
    'Доля общей премии, в рублях с копейками.';

COMMENT ON COLUMN main.shared_premiums.accrual_id IS
    'Начисление, которое закрыло этот отрезок. Пусто — долю можно пересчитать.';
