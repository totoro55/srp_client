-- Подробности ошибки пересчёта: тип, маршрут, место в базе и стек.
-- Короткая фраза остаётся в error_message для поиска и уведомления.

ALTER TABLE premium_recalc_runs
    ADD COLUMN IF NOT EXISTS error_detail JSONB;

COMMENT ON COLUMN premium_recalc_runs.error_detail IS
    'Тип ошибки, маршрут, код и место в базе, фрагмент запроса и стек. Пусто у успешного и ещё идущего запуска.';
