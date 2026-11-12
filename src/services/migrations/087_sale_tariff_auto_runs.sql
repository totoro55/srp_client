-- Журнал автоматического расчёта тарифов по продажам.
-- На территорию и месяц одна строка. Успешный расчёт в этом месяце не повторяется.
-- Повторный запуск не пересоздаёт таблицу.

CREATE TABLE IF NOT EXISTS sale_tariff_auto_runs (
    territory_uuid UUID NOT NULL,
    period DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    saved INTEGER,
    detail TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, period),
    CONSTRAINT sale_tariff_auto_runs_status_check CHECK (status IN ('success', 'failed')),
    CONSTRAINT sale_tariff_auto_runs_period_month CHECK (period = date_trunc('month', period)::date)
);

COMMENT ON TABLE sale_tariff_auto_runs IS
    'Автоматический расчёт тарифов по продажам. Одна строка на территорию и месяц. success повторно не запускается.';

COMMENT ON COLUMN sale_tariff_auto_runs.territory_uuid IS
    'Территория, для которой выполнен или не выполнен автоматический расчёт.';

COMMENT ON COLUMN sale_tariff_auto_runs.period IS
    'Месяц расчёта, первое число.';

COMMENT ON COLUMN sale_tariff_auto_runs.status IS
    'success — тарифы записаны, failed — расчёт не записан и будет повторён.';

COMMENT ON COLUMN sale_tariff_auto_runs.saved IS
    'Сколько строк тарифа записано. Пусто, если запись не выполнена.';

COMMENT ON COLUMN sale_tariff_auto_runs.detail IS
    'Причина, по которой расчёт не записан. Пусто при успехе.';

COMMENT ON COLUMN sale_tariff_auto_runs.updated_at IS
    'Когда эта попытка завершилась.';
