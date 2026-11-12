-- Статус запуска пересчёта: идёт, успех или ошибка.
-- Повторный запуск не добавляет столбцы заново.
-- Один снимок не переписывается двумя запусками сразу.

ALTER TABLE premium_recalc_runs
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'success';

ALTER TABLE premium_recalc_runs
    ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

ALTER TABLE premium_recalc_runs
    ADD COLUMN IF NOT EXISTS error_message TEXT NOT NULL DEFAULT '';

UPDATE premium_recalc_runs
SET finished_at = created_at
WHERE finished_at IS NULL
  AND status = 'success';

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_status_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_status_check
    CHECK (status IN ('running', 'success', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS premium_recalc_runs_active_uidx
    ON premium_recalc_runs (basket_kind, period)
    WHERE status = 'running';

COMMENT ON COLUMN premium_recalc_runs.status IS
    'running — снимок переписывается, success — строки записаны, failed — запись не завершилась.';

COMMENT ON COLUMN premium_recalc_runs.finished_at IS
    'Когда запуск завершился успехом или ошибкой. Пусто, пока статус running.';

COMMENT ON COLUMN premium_recalc_runs.error_message IS
    'Почему снимок не записался. Пусто у успешного и ещё идущего запуска.';
