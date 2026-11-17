-- Доля бригады хранит сотрудника как uuid, как начисление и закрытый отрезок.
-- Уже применённая 122 создала колонку текстом. Повторно тип не меняется.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'main'
          AND table_name = 'brigade_premium_shares'
          AND column_name = 'employee_uuid'
          AND udt_name IN ('text', 'varchar')
    ) THEN
        ALTER TABLE main.brigade_premium_shares
            ALTER COLUMN employee_uuid TYPE uuid
            USING NULLIF(btrim(employee_uuid), '')::uuid;
    END IF;
END $$;

COMMENT ON COLUMN main.brigade_premium_shares.employee_uuid IS
    'Сотрудник.';
