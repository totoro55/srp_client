-- Правила директора поверх формулы тарифа.
-- Срез: ближайший period <= месяца расчёта и только та же ось, что у подключённой версии.
-- removed = true гасит правило с этого месяца, не стирая прошлые.

CREATE TABLE IF NOT EXISTS basket_tariff_exceptions (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    period DATE NOT NULL,
    axis VARCHAR(20) NOT NULL,
    code UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    base_mode VARCHAR(20) NOT NULL,
    main NUMERIC,
    im NUMERIC,
    b2b NUMERIC,
    removed BOOLEAN NOT NULL DEFAULT FALSE,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    set_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (territory_uuid, period, axis, code),
    CONSTRAINT basket_tariff_exceptions_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT basket_tariff_exceptions_axis_check CHECK (axis IN ('category', 'product_kind')),
    CONSTRAINT basket_tariff_exceptions_mode_check CHECK (base_mode IN ('percent', 'per_unit'))
);

COMMENT ON TABLE basket_tariff_exceptions IS
    'Исключение тарифа: способ основного тарифа и необязательные перезаписи main, im, b2b. ИМ и B2B всегда за количество.';

CREATE INDEX IF NOT EXISTS basket_tariff_exceptions_slice_idx
    ON basket_tariff_exceptions (territory_uuid, axis, period DESC);

CREATE TABLE IF NOT EXISTS basket_tariff_exceptions_log (
    id BIGSERIAL PRIMARY KEY,
    territory_uuid UUID NOT NULL,
    period DATE NOT NULL,
    axis VARCHAR(20) NOT NULL,
    code UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    base_mode VARCHAR(20) NOT NULL,
    main NUMERIC,
    im NUMERIC,
    b2b NUMERIC,
    removed BOOLEAN NOT NULL,
    set_at TIMESTAMPTZ NOT NULL,
    set_by VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by VARCHAR(255) NOT NULL,
    CONSTRAINT basket_tariff_exceptions_log_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_tariff_exceptions_log_idx
    ON basket_tariff_exceptions_log (territory_uuid, period, recorded_at DESC);
