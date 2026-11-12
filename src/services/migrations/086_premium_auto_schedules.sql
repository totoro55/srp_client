-- Два расписания вместо одного списка дней недели.
-- sale_tariffs — тарифы корзины продаж, один день месяца и время.
-- baskets — снимки продажи и выдачи, каждый день в заданное время.
-- Пустое время значит, что это расписание ещё не задано.

DROP TABLE IF EXISTS premium_recalc_schedule;

CREATE TABLE IF NOT EXISTS premium_auto_schedules (
    kind VARCHAR(20) PRIMARY KEY,
    day_of_month SMALLINT,
    run_time VARCHAR(5) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT,
    CONSTRAINT premium_auto_schedules_kind_check CHECK (kind IN ('sale_tariffs', 'baskets')),
    CONSTRAINT premium_auto_schedules_day_check CHECK (
        day_of_month IS NULL OR day_of_month BETWEEN 1 AND 28
    ),
    CONSTRAINT premium_auto_schedules_time_check CHECK (
        run_time = '' OR run_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    ),
    CONSTRAINT premium_auto_schedules_shape_check CHECK (
        (kind = 'baskets' AND day_of_month IS NULL)
        OR (
            kind = 'sale_tariffs'
            AND (
                (day_of_month IS NULL AND run_time = '')
                OR (day_of_month IS NOT NULL AND run_time <> '')
            )
        )
    )
);

INSERT INTO premium_auto_schedules (kind)
VALUES ('sale_tariffs'), ('baskets')
ON CONFLICT (kind) DO NOTHING;

COMMENT ON TABLE premium_auto_schedules IS
    'Расписания автоматических пересчётов. sale_tariffs — тарифы корзины продаж раз в месяц. baskets — снимки продажи и выдачи каждый день.';

COMMENT ON COLUMN premium_auto_schedules.kind IS
    'sale_tariffs — тарифы корзины продаж, baskets — снимки продажи и выдачи.';

COMMENT ON COLUMN premium_auto_schedules.day_of_month IS
    'День месяца для тарифов, от 1 до 28. У ежедневных расчётов пусто.';

COMMENT ON COLUMN premium_auto_schedules.run_time IS
    'Время запуска, часы и минуты. Пустая строка — время не задано.';

COMMENT ON COLUMN premium_auto_schedules.updated_by IS
    'Кто последним сохранил это расписание. Можно не заполнять.';
