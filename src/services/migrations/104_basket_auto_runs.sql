-- Итог ежедневной автозагрузки премии.
-- Одна строка на календарный день Москвы. Успех в этот день не повторяется.
-- Повторный запуск не пересоздаёт таблицу.

CREATE TABLE IF NOT EXISTS basket_auto_runs (
    run_on DATE PRIMARY KEY,
    period DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT basket_auto_runs_status_check CHECK (status IN ('success', 'failed')),
    CONSTRAINT basket_auto_runs_period_month CHECK (period = date_trunc('month', period)::date)
);

COMMENT ON TABLE basket_auto_runs IS
    'Ежедневная автозагрузка премии. Одна строка на календарный день Москвы. success в этот день повторно не запускается.';

COMMENT ON COLUMN basket_auto_runs.run_on IS
    'Календарный день запуска по Москве. Это не месяц премии: 1 ноября считает октябрь.';

COMMENT ON COLUMN basket_auto_runs.period IS
    'Месяц премии, первое число. Месяц вчерашнего дня по Москве.';

COMMENT ON COLUMN basket_auto_runs.status IS
    'success — штатное, корзины и общая премия записаны, failed — цепочка не закончилась и будет повторена.';

COMMENT ON COLUMN basket_auto_runs.detail IS
    'Почему цепочка не закончилась. Пусто при успехе.';

COMMENT ON COLUMN basket_auto_runs.updated_at IS
    'Когда эта попытка завершилась.';
