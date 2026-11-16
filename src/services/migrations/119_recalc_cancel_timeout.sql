-- Отмена пересчёта, таймаут журнала и один проход автотарифов за московский день.
-- Повторный запуск не ломает уже выданные права на отмену.

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_status_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_status_check
    CHECK (status IN ('running', 'success', 'failed', 'cancelled'));

COMMENT ON COLUMN premium_recalc_runs.status IS
    'running — снимок переписывается, success — строки записаны, failed — запись не завершилась, cancelled — остановлен человеком или по таймауту.';

CREATE TABLE IF NOT EXISTS sale_tariff_schedule_days (
    run_on DATE PRIMARY KEY,
    period DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
    detail TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sale_tariff_schedule_days IS
    'Автоматический проход тарифов продажи в день расписания по Москве. Успех дня повторно не запускается; в другие дни месяца автозапуск не выполняется.';

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'recalc:cancel'
FROM role_permission_codes
WHERE permission_code IN ('recalc:write', 'baskets:connect')
ON CONFLICT DO NOTHING;
