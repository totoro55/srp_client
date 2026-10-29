-- Заметка о смене версии или отключении корзины в открытом месяце.
-- Опора расчёта тарифов одна на территорию и месяц.

ALTER TABLE basket_connections
    ADD COLUMN IF NOT EXISTS change_note TEXT;

ALTER TABLE basket_connections_log
    ADD COLUMN IF NOT EXISTS change_note TEXT;

COMMENT ON COLUMN basket_connections.change_note IS
    'Пояснение к смене версии или отключению корзины: какие данные месяца удалены.';

CREATE TABLE IF NOT EXISTS basket_tariff_month (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    period DATE NOT NULL,
    reference VARCHAR(20) NOT NULL DEFAULT 'mean',
    PRIMARY KEY (territory_uuid, period),
    CONSTRAINT basket_tariff_month_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT basket_tariff_month_reference_check CHECK (reference IN ('mean', 'median', 'trimmed', 'priceAdjusted'))
);

COMMENT ON TABLE basket_tariff_month IS
    'Опора расчёта тарифов территории за месяц. На территорию и месяц приходится одна запись. По умолчанию применяется среднее.';
