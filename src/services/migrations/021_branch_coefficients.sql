-- Значения коэффициентов филиала на месяц.
-- В таблице только филиалы, включённые в мотивацию на выбранный месяц.
-- Филиал без значения коэффициента показывается со значением 1.
-- Срез: ближайший period <= месяца расчёта. Прошлые месяцы не удаляются.

CREATE TABLE IF NOT EXISTS basket_branch_coefficients (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    period DATE NOT NULL,
    branch_uuid UUID NOT NULL REFERENCES branches (uuid) ON DELETE CASCADE,
    coefficient_key VARCHAR(50) NOT NULL,
    value NUMERIC NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    set_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (territory_uuid, basket_id, period, branch_uuid, coefficient_key),
    CONSTRAINT basket_branch_coefficients_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_branch_coefficients_slice_idx
    ON basket_branch_coefficients (territory_uuid, basket_id, period DESC);

COMMENT ON TABLE basket_branch_coefficients IS
    'Значение коэффициента версии корзины для филиала с указанного месяца.';

CREATE TABLE IF NOT EXISTS basket_branch_coefficients_log (
    id BIGSERIAL PRIMARY KEY,
    territory_uuid UUID NOT NULL,
    basket_id INTEGER NOT NULL,
    period DATE NOT NULL,
    branch_uuid UUID NOT NULL,
    coefficient_key VARCHAR(50) NOT NULL,
    value NUMERIC NOT NULL,
    set_at TIMESTAMPTZ NOT NULL,
    set_by VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by VARCHAR(255) NOT NULL,
    CONSTRAINT basket_branch_coefficients_log_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_branch_coefficients_log_idx
    ON basket_branch_coefficients_log (territory_uuid, basket_id, period, recorded_at DESC);
