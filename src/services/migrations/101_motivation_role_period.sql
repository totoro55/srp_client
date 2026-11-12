-- Ручная роль действует с месяца period, пока у сотрудника нет более поздней записи.
-- За месяц одна роль. automatic — с этого месяца снова роль по правилу.
-- Уже сохранённые назначения начинаются с первого загруженного штатного месяца.

ALTER TABLE branch_motivation_roles
    ADD COLUMN IF NOT EXISTS period DATE;

ALTER TABLE branch_motivation_roles
    ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE branch_motivation_roles
SET period = COALESCE(
    (SELECT MIN(period) FROM raw.hr_ktu),
    (date_trunc('month', (NOW() AT TIME ZONE 'Europe/Moscow')))::date
)
WHERE period IS NULL;

ALTER TABLE branch_motivation_roles
    ALTER COLUMN period SET NOT NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branch_motivation_roles_pkey'
          AND conrelid = 'branch_motivation_roles'::regclass
          AND pg_get_constraintdef(oid) NOT LIKE '%period%'
    ) THEN
        ALTER TABLE branch_motivation_roles DROP CONSTRAINT branch_motivation_roles_pkey;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branch_motivation_roles_pkey'
          AND conrelid = 'branch_motivation_roles'::regclass
    ) THEN
        ALTER TABLE branch_motivation_roles
            ADD CONSTRAINT branch_motivation_roles_pkey PRIMARY KEY (branch_uuid, employee_uuid, period);
    END IF;
END $$;

ALTER TABLE branch_motivation_roles
    DROP CONSTRAINT IF EXISTS branch_motivation_roles_period_month;

ALTER TABLE branch_motivation_roles
    ADD CONSTRAINT branch_motivation_roles_period_month
    CHECK (period = date_trunc('month', period)::date);

ALTER TABLE branch_motivation_roles
    DROP CONSTRAINT IF EXISTS branch_motivation_roles_automatic_role;

ALTER TABLE branch_motivation_roles
    ADD CONSTRAINT branch_motivation_roles_automatic_role
    CHECK (NOT automatic OR role_id IS NULL);

CREATE INDEX IF NOT EXISTS branch_motivation_roles_slice_idx
    ON branch_motivation_roles (lower(branch_uuid), lower(employee_uuid), period DESC);

COMMENT ON TABLE branch_motivation_roles IS
    'Ручная роль сотрудника на филиале с указанного месяца. Следующая запись этого сотрудника сменяет предыдущую. Нет записи — роль из правила.';

COMMENT ON COLUMN branch_motivation_roles.period IS
    'Месяц начала действия, первое число. На расчёт берётся ближайшая запись не позже месяца.';

COMMENT ON COLUMN branch_motivation_roles.role_id IS
    'Назначенная роль. Пусто при automatic = false — явное снятие роли.';

COMMENT ON COLUMN branch_motivation_roles.automatic IS
    'С этого месяца роль снова берётся из правила. role_id при этом пустой.';
