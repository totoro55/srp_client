-- Выдача филиала и настроек управляющему внутри одной РРС.
-- Строка хранит решение этой РРС. Она читается, только пока территория сотрудника
-- в справочнике совпадает с territory_uuid и филиал всё ещё в этой РРС.
-- После перевода в другую РРС строки остаются, но не применяются.
-- Свой филиал: нет строки — действует роль, allowed = false снимает настройку.
-- Чужой филиал: нет строки — закрыт. branch.access открывает кабинет,
-- остальные коды с allowed = true включают настройку.

CREATE TABLE IF NOT EXISTS manager_branch_grants (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    employee_uuid UUID NOT NULL,
    branch_uuid UUID NOT NULL REFERENCES branches (uuid) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL,
    allowed BOOLEAN NOT NULL,
    granted_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, employee_uuid, branch_uuid, permission_code),
    CONSTRAINT manager_branch_grants_code_check CHECK (
        permission_code IN (
            'branch.access',
            'branch.roles:write',
            'branch.brigades:write',
            'branch.shared:write'
        )
    ),
    CONSTRAINT manager_branch_grants_access_check CHECK (
        permission_code <> 'branch.access' OR allowed
    )
);

COMMENT ON TABLE manager_branch_grants IS
    'Выдача филиала и настроек управляющему внутри РРС. Чужой филиал без строки закрыт. На своём филиале нет строки — действует роль, строка с ложью снимает настройку. После перевода в другую РРС строки прежней РРС не читаются.';

COMMENT ON COLUMN manager_branch_grants.employee_uuid IS
    'Управляющий. Запись действует, пока его территория в справочнике совпадает с territory_uuid.';

COMMENT ON COLUMN manager_branch_grants.permission_code IS
    'branch.access открывает кабинет чужого филиала. branch.roles:write, branch.brigades:write и branch.shared:write — настройки филиала.';

COMMENT ON COLUMN manager_branch_grants.allowed IS
    'Для своего филиала ложь снимает настройку роли. Для чужого филиала истина выдаёт доступ или настройку.';

COMMENT ON COLUMN manager_branch_grants.granted_by IS
    'Кто последним записал строку.';

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'branch.grants:write'
FROM roles
WHERE code = 'rrs-director'
ON CONFLICT DO NOTHING;
