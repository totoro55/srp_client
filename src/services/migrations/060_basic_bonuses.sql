-- Базовая премия филиала за месяц. Таблицу заполняют снаружи.
-- Приложение читает её, когда решает, можно ли подключить филиал к мотивации, и не пишет.
-- Повторный запуск не пересоздаёт таблицу, если выгрузка уже её положила.

CREATE TABLE IF NOT EXISTS raw.basic_bonuses (
    branch_uuid UUID NOT NULL,
    base_bonus VARCHAR(255) NOT NULL,
    period DATE NOT NULL,
    CONSTRAINT basic_bonuses_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT basic_bonuses_branch_uuid_fkey
        FOREIGN KEY (branch_uuid) REFERENCES dictionaries.branches (uuid),
    PRIMARY KEY (branch_uuid, period)
);

COMMENT ON TABLE raw.basic_bonuses IS
    'Базовая премия филиала за месяц. Заполняется снаружи.';

COMMENT ON COLUMN raw.basic_bonuses.base_bonus IS
    'Базовая премия филиала. Число хранится текстом, как в выгрузке.';

COMMENT ON COLUMN raw.basic_bonuses.period IS
    'Месяц премии, первое число.';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basic_bonuses_pkey' AND conrelid = 'raw.basic_bonuses'::regclass
    ) THEN
        ALTER TABLE raw.basic_bonuses
            ADD CONSTRAINT basic_bonuses_pkey PRIMARY KEY (branch_uuid, period);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'basic_bonuses_branch_uuid_fkey' AND conrelid = 'raw.basic_bonuses'::regclass
    ) THEN
        ALTER TABLE raw.basic_bonuses
            ADD CONSTRAINT basic_bonuses_branch_uuid_fkey
            FOREIGN KEY (branch_uuid) REFERENCES dictionaries.branches (uuid);
    END IF;
END $$;
