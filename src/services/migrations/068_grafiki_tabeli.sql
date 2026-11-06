-- График и табель сотрудника по дням. Таблицу заполняют снаружи, приложение только читает.
-- Внешних ключей нет: срез перезаписывается.
-- Один день бывает несколькими строками: график, табель и нулевая копия. Ключа нет.
-- Имя noma_day остаётся как в выгрузке.
-- Повторный запуск не пересоздаёт таблицу, если выгрузка уже её положила.

CREATE TABLE IF NOT EXISTS raw.grafiki_tabeli (
    period TIMESTAMP NULL,
    date TIMESTAMP NULL,
    branch_uuid UUID NULL,
    employees_uuid UUID NULL,
    noma_day DOUBLE PRECISION NULL,
    fact_day DOUBLE PRECISION NULL,
    norma_hour DOUBLE PRECISION NULL,
    fact_hour DOUBLE PRECISION NULL
);

COMMENT ON TABLE raw.grafiki_tabeli IS
    'День графика и табеля сотрудника на филиале. Заполняется снаружи. День может повторяться, приложение берёт максимум каждого показателя за день.';

COMMENT ON COLUMN raw.grafiki_tabeli.period IS
    'Месяц, первое число, полночь.';

COMMENT ON COLUMN raw.grafiki_tabeli.date IS
    'День внутри месяца.';

COMMENT ON COLUMN raw.grafiki_tabeli.branch_uuid IS
    'Филиал. Без связи со справочником филиалов.';

COMMENT ON COLUMN raw.grafiki_tabeli.employees_uuid IS
    'Сотрудник. Без связи со справочником сотрудников.';

COMMENT ON COLUMN raw.grafiki_tabeli.noma_day IS
    'Норма дней графика. Имя колонки как в выгрузке.';

COMMENT ON COLUMN raw.grafiki_tabeli.fact_day IS
    'Факт дней по табелю.';

COMMENT ON COLUMN raw.grafiki_tabeli.norma_hour IS
    'Часы графика за день.';

COMMENT ON COLUMN raw.grafiki_tabeli.fact_hour IS
    'Часы табеля за день.';

CREATE INDEX IF NOT EXISTS grafiki_tabeli_period_branch_idx
    ON raw.grafiki_tabeli (period, branch_uuid);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'grafiki_tabeli_period_month' AND conrelid = 'raw.grafiki_tabeli'::regclass
    ) THEN
        ALTER TABLE raw.grafiki_tabeli
            ADD CONSTRAINT grafiki_tabeli_period_month
            CHECK (period IS NULL OR period = date_trunc('month', period));
    END IF;
END $$;
