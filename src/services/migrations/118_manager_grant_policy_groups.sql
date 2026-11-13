-- Общая выдача делится по должности.
-- Прежняя строка без должности действовала на всех трёх должностей, поэтому она копируется.

ALTER TABLE manager_grant_policies
    ADD COLUMN IF NOT EXISTS title_group VARCHAR(20);

ALTER TABLE manager_grant_policies
    DROP CONSTRAINT IF EXISTS manager_grant_policies_pkey;

INSERT INTO manager_grant_policies (
    territory_uuid, permission_code, enabled, updated_by, updated_at, title_group
)
SELECT policy.territory_uuid,
       policy.permission_code,
       policy.enabled,
       policy.updated_by,
       policy.updated_at,
       group_name.title_group
FROM manager_grant_policies policy
CROSS JOIN (
    VALUES ('deputy'), ('senior')
) AS group_name(title_group)
WHERE policy.title_group IS NULL;

UPDATE manager_grant_policies
SET title_group = 'manager'
WHERE title_group IS NULL;

ALTER TABLE manager_grant_policies
    ALTER COLUMN title_group SET NOT NULL;

ALTER TABLE manager_grant_policies
    ADD PRIMARY KEY (territory_uuid, permission_code, title_group);

ALTER TABLE manager_grant_policies
    DROP CONSTRAINT IF EXISTS manager_grant_policies_group_check;

ALTER TABLE manager_grant_policies
    ADD CONSTRAINT manager_grant_policies_group_check
    CHECK (title_group IN ('manager', 'deputy', 'senior'));

COMMENT ON TABLE manager_grant_policies IS
    'Общая выдача доступа внутри РРС по должности. Включённая отметка действует для текущих и новых сотрудников этой должности, пока у сотрудника нет личной строки.';

COMMENT ON COLUMN manager_grant_policies.title_group IS
    'manager — управляющий, deputy — заместитель управляющего, senior — старший продавец.';

COMMENT ON COLUMN manager_grant_policies.enabled IS
    'Истина включает отметку для должности. Выключенная общая выдача не хранится.';
