-- Состав бригады филиала на месяц и доля сотрудника по корзине.
-- Доля пишется пересчётом. Отрезок, который пересекается с начислением, не меняется.

CREATE TABLE IF NOT EXISTS main.branch_brigades (
    branch_uuid UUID NOT NULL,
    period DATE NOT NULL,
    mode TEXT NOT NULL,
    PRIMARY KEY (branch_uuid, period),
    CONSTRAINT branch_brigades_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT branch_brigades_mode_check CHECK (mode IN ('off', 'all', 'groups'))
);

COMMENT ON TABLE main.branch_brigades IS
    'Режим бригады филиала с месяца period до следующей записи этого филиала: выключена, общая или отдельные группы.';

COMMENT ON COLUMN main.branch_brigades.mode IS
    'off — личная премия. all — все, кто в расчёте. groups — только сотрудники групп.';

CREATE TABLE IF NOT EXISTS main.branch_brigade_groups (
    id UUID PRIMARY KEY,
    branch_uuid UUID NOT NULL,
    period DATE NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    CONSTRAINT branch_brigade_groups_setup
        FOREIGN KEY (branch_uuid, period)
        REFERENCES main.branch_brigades (branch_uuid, period)
        ON DELETE CASCADE,
    CONSTRAINT branch_brigade_groups_name_check CHECK (btrim(name) <> ''),
    CONSTRAINT branch_brigade_groups_order_check CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS branch_brigade_groups_branch_idx
    ON main.branch_brigade_groups (branch_uuid, period, sort_order);

COMMENT ON TABLE main.branch_brigade_groups IS
    'Именованная группа бригады. В режиме «общая» и «выключена» группы хранятся, но в расчёт не входят.';

CREATE TABLE IF NOT EXISTS main.branch_brigade_members (
    group_id UUID NOT NULL REFERENCES main.branch_brigade_groups (id) ON DELETE CASCADE,
    employee_uuid UUID NOT NULL,
    PRIMARY KEY (group_id, employee_uuid)
);

COMMENT ON TABLE main.branch_brigade_members IS
    'Сотрудник группы. В одной группе один раз. Расчёт берёт только тех, кто в расчёте.';

CREATE TABLE IF NOT EXISTS main.brigade_premium_shares (
    period DATE NOT NULL,
    territory_uuid UUID NOT NULL,
    branch_uuid UUID NOT NULL,
    employee_uuid UUID NOT NULL,
    active_from DATE NOT NULL,
    active_until DATE NOT NULL,
    indicator TEXT NOT NULL,
    premium NUMERIC(18, 2) NOT NULL,
    accrual_id BIGINT REFERENCES main.premium_accruals (id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (period, branch_uuid, employee_uuid, active_from, indicator),
    CONSTRAINT brigade_premium_shares_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT brigade_premium_shares_interval CHECK (active_from <= active_until),
    CONSTRAINT brigade_premium_shares_indicator_check CHECK (indicator IN (
        'Продажа товара',
        'Выдача товара',
        'Кассовые операции',
        'ОСНТ',
        'Складские операции',
        'Разгрузка ТС'
    ))
);

CREATE INDEX IF NOT EXISTS brigade_premium_shares_branch_idx
    ON main.brigade_premium_shares (period, branch_uuid, indicator);

COMMENT ON TABLE main.brigade_premium_shares IS
    'Доля бригады по корзине за отрезок штатного расписания. Нет строки — в кабинете личная премия. Пересчёт не меняет отрезок, который пересекается с начислением.';

COMMENT ON COLUMN main.brigade_premium_shares.employee_uuid IS
    'Сотрудник.';

COMMENT ON COLUMN main.brigade_premium_shares.premium IS
    'Доля корзины, в рублях с копейками. Ноль — часов по табелю не было, личная премия ушла в котёл.';

COMMENT ON COLUMN main.brigade_premium_shares.accrual_id IS
    'Начисление, которое закрыло этот отрезок. Пусто — долю можно пересчитать.';
