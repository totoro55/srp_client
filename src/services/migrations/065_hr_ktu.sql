-- Штатное расписание месяца. Таблицу заполняют снаружи, приложение только читает.
-- У сотрудника за месяц бывает несколько строк: текущая — с наибольшей date_modified.
-- Повторный запуск не пересоздаёт таблицу, если выгрузка уже её положила.

CREATE TABLE IF NOT EXISTS raw.hr_ktu (
    period DATE NULL,
    employees_uuid TEXT NULL,
    branch_uuid TEXT NULL,
    title TEXT NULL,
    probation BOOLEAN NULL,
    ktu BOOLEAN NULL,
    hourly_rate DOUBLE PRECISION NULL,
    salary_amount DOUBLE PRECISION NULL,
    date_modified DATE NULL,
    status TEXT NULL
);

COMMENT ON TABLE raw.hr_ktu IS
    'Штатное расписание сотрудника за месяц. Заполняется снаружи. Текущая строка месяца — с наибольшей date_modified.';

COMMENT ON COLUMN raw.hr_ktu.period IS
    'Месяц расписания, первое число.';

COMMENT ON COLUMN raw.hr_ktu.employees_uuid IS
    'Сотрудник. Uuid текстом, как в выгрузке.';

COMMENT ON COLUMN raw.hr_ktu.branch_uuid IS
    'Филиал. Uuid текстом, как в выгрузке.';

COMMENT ON COLUMN raw.hr_ktu.title IS
    'Должность в этом месяце.';

COMMENT ON COLUMN raw.hr_ktu.probation IS
    'Испытательный срок. Пустое значение считается как нет.';

COMMENT ON COLUMN raw.hr_ktu.ktu IS
    'Участие в сдельной оплате: истина — КТУ+, ложь — КТУ−. Пустое значение считается как КТУ−.';

COMMENT ON COLUMN raw.hr_ktu.hourly_rate IS
    'Часовая ставка. Ноль у должности с одним окладом.';

COMMENT ON COLUMN raw.hr_ktu.salary_amount IS
    'Оклад.';

COMMENT ON COLUMN raw.hr_ktu.date_modified IS
    'Дата версии строки внутри месяца.';

COMMENT ON COLUMN raw.hr_ktu.status IS
    'Работающий, Длительное отсутствие или Уволен.';

CREATE INDEX IF NOT EXISTS hr_ktu_period_branch_idx
    ON raw.hr_ktu (period, branch_uuid);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'hr_ktu_pkey' AND conrelid = 'raw.hr_ktu'::regclass
    ) THEN
        ALTER TABLE raw.hr_ktu
            ALTER COLUMN period SET NOT NULL,
            ALTER COLUMN employees_uuid SET NOT NULL,
            ALTER COLUMN date_modified SET NOT NULL;
        ALTER TABLE raw.hr_ktu
            ADD CONSTRAINT hr_ktu_pkey PRIMARY KEY (period, employees_uuid, date_modified);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'hr_ktu_period_month' AND conrelid = 'raw.hr_ktu'::regclass
    ) THEN
        ALTER TABLE raw.hr_ktu
            ADD CONSTRAINT hr_ktu_period_month CHECK (period = date_trunc('month', period)::date);
    END IF;
END $$;
