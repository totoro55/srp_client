-- Снимок: с какого месяца на территории действует какая версия корзины.
-- version_id NULL — с этого месяца корзина явно отключена.
-- Строки прошлых месяцев не удаляются: срез последних берёт ближайший period <= месяца расчёта.

CREATE TABLE IF NOT EXISTS basket_connections (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    period DATE NOT NULL,
    version_id INTEGER REFERENCES basket_versions (id),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    connected_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (territory_uuid, basket_id, period),
    CONSTRAINT basket_connections_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_connections_slice_idx
    ON basket_connections (territory_uuid, basket_id, period DESC);

COMMENT ON TABLE basket_connections IS
    'Какая версия корзины действует на территории с указанного месяца. NULL в version_id — отключена с этого месяца.';

CREATE TABLE IF NOT EXISTS basket_connections_log (
    id BIGSERIAL PRIMARY KEY,
    territory_uuid UUID NOT NULL,
    basket_id INTEGER NOT NULL,
    period DATE NOT NULL,
    version_id INTEGER,
    connected_at TIMESTAMPTZ NOT NULL,
    connected_by VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by VARCHAR(255) NOT NULL,
    CONSTRAINT basket_connections_log_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_connections_log_idx
    ON basket_connections_log (territory_uuid, basket_id, period, recorded_at DESC);

COMMENT ON TABLE basket_connections_log IS
    'Предыдущий снимок того же месяца перед исправлением подключения.';
