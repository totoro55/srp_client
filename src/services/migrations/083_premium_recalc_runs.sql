-- История пересчёта снимков премии.
-- Системный запуск приходит от загрузчика, ручной — со страницы обновления данных.
-- Повторный запуск не пересоздаёт таблицу и не дублирует уже перенесённые события.

CREATE TABLE IF NOT EXISTS premium_recalc_runs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    basket_kind VARCHAR(20) NOT NULL,
    period DATE NOT NULL,
    origin VARCHAR(20) NOT NULL,
    trigger_name TEXT NOT NULL DEFAULT '',
    actor TEXT NOT NULL,
    lines INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT premium_recalc_runs_kind_check CHECK (basket_kind IN ('sale', 'release')),
    CONSTRAINT premium_recalc_runs_origin_check CHECK (origin IN ('system', 'manual')),
    CONSTRAINT premium_recalc_runs_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS premium_recalc_runs_kind_created_idx
    ON premium_recalc_runs (basket_kind, created_at DESC);

COMMENT ON TABLE premium_recalc_runs IS
    'Запуск пересчёта снимка премии. origin system — загрузчик, manual — человек. trigger_name — причина системного запуска.';

COMMENT ON COLUMN premium_recalc_runs.basket_kind IS
    'sale — продажа товара, release — выдача товара.';

COMMENT ON COLUMN premium_recalc_runs.origin IS
    'system — запуск загрузчиком, manual — запуск со страницы.';

COMMENT ON COLUMN premium_recalc_runs.trigger_name IS
    'Причина системного запуска: raw.sale — загрузка продаж, raw.hr_ktu — загрузка штатного расписания. Пусто, если причину не передали или запуск ручной.';

COMMENT ON COLUMN premium_recalc_runs.lines IS
    'Сколько строк записано в снимок. Пусто у события, перенесённого из старого журнала.';

INSERT INTO premium_recalc_runs (basket_kind, period, origin, trigger_name, actor, lines, created_at)
SELECT CASE event.action
           WHEN 'sale-premium.recalculate' THEN 'sale'
           ELSE 'release'
       END,
       split_part(event.details, ';', 1)::date,
       CASE WHEN event.actor_username = 'airflow' THEN 'system' ELSE 'manual' END,
       CASE
           WHEN event.actor_username = 'airflow' THEN btrim(split_part(event.details, ';', 3))
           ELSE ''
       END,
       event.actor_username,
       NULL,
       event.created_at
FROM audit_events event
WHERE event.action IN ('sale-premium.recalculate', 'release-premium.recalculate')
  AND split_part(event.details, ';', 1) ~ '^\d{4}-\d{2}-01$'
  AND NOT EXISTS (
      SELECT 1
      FROM premium_recalc_runs existing
      WHERE existing.basket_kind = CASE event.action
                                       WHEN 'sale-premium.recalculate' THEN 'sale'
                                       ELSE 'release'
                                   END
        AND existing.period = split_part(event.details, ';', 1)::date
        AND existing.actor = event.actor_username
        AND existing.created_at = event.created_at
  );
