-- Расписание автоматического пересчёта снимков премии.
-- Одна строка: дни недели и время. Пустые дни и пустое время — расписание ещё не задано.
-- Запуск по этому расписанию в процесс приложения не входит: строка только хранит выбор.

CREATE TABLE IF NOT EXISTS premium_recalc_schedule (
    id INTEGER PRIMARY KEY DEFAULT 1,
    weekdays SMALLINT[] NOT NULL DEFAULT ARRAY[]::SMALLINT[],
    run_time VARCHAR(5) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT,
    CONSTRAINT premium_recalc_schedule_singleton CHECK (id = 1),
    CONSTRAINT premium_recalc_schedule_time_check CHECK (
        run_time = '' OR run_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT premium_recalc_schedule_days_check CHECK (
        weekdays <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::SMALLINT[]
    )
);

INSERT INTO premium_recalc_schedule (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE premium_recalc_schedule IS
    'Дни и время автоматического пересчёта продажи и выдачи. Одна строка. Пустое расписание значит, что дни и время ещё не заданы.';

COMMENT ON COLUMN premium_recalc_schedule.weekdays IS
    'Дни недели по ISO: 1 — понедельник, 7 — воскресенье. Пустой список — дни не выбраны.';

COMMENT ON COLUMN premium_recalc_schedule.run_time IS
    'Время запуска, часы и минуты. Пустая строка — время не задано.';

COMMENT ON COLUMN premium_recalc_schedule.updated_by IS
    'Кто последним сохранил расписание. Можно не заполнять.';
