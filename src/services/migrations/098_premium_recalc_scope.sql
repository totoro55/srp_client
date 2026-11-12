-- Уровень пересчёта и чем он запущен.
-- Повторный запуск не добавляет столбцы заново.
-- Уже записанные запуски — снимок всего дивизиона.

ALTER TABLE premium_recalc_runs
    ADD COLUMN IF NOT EXISTS scope_level VARCHAR(20) NOT NULL DEFAULT '';

ALTER TABLE premium_recalc_runs
    ADD COLUMN IF NOT EXISTS scope_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE premium_recalc_runs
SET scope_level = 'division'
WHERE scope_level = '';

ALTER TABLE premium_recalc_runs
    ALTER COLUMN scope_level SET DEFAULT 'division';

ALTER TABLE premium_recalc_runs
    DROP CONSTRAINT IF EXISTS premium_recalc_runs_scope_level_check;

ALTER TABLE premium_recalc_runs
    ADD CONSTRAINT premium_recalc_runs_scope_level_check
    CHECK (scope_level IN ('division', 'territory', 'branch'));

COMMENT ON COLUMN premium_recalc_runs.scope_level IS
    'division — весь дивизион, territory — РРС, branch — филиалы.';

COMMENT ON COLUMN premium_recalc_runs.scope_ids IS
    'Uuid РРС или филиалов этого запуска. Пусто у дивизиона.';

COMMENT ON COLUMN premium_recalc_runs.trigger_name IS
    'Чем запущен пересчёт: raw.sale, raw.hr_ktu, raw.kassa_oper, branch.roles, branch.shared-roles, tariffs, coefficients, manual. Пусто, если причину не передали.';

COMMENT ON TABLE app_notifications IS
    'Событие для конкретного человека. kind — раздел: feedback или recalc. source_key связывает событие с объектом, чтобы открытие погасило связанные записи.';

COMMENT ON COLUMN app_notifications.kind IS
    'Раздел события: feedback — обращение, recalc — завершение пересчёта.';
