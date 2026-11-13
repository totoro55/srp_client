-- По умолчанию у управляющего открыт только свой кабинет.
-- Общая выдача включает отметку всем текущим и новым сотрудникам РРС.
-- Личная строка важнее общей выдачи: истина включает, ложь снимает.
-- Доступ к чужому кабинету тоже можно снять, поэтому запрет branch.access допустим.

ALTER TABLE manager_branch_grants
    DROP CONSTRAINT IF EXISTS manager_branch_grants_access_check;

COMMENT ON TABLE manager_branch_grants IS
    'Личная выдача филиала и настроек внутри РРС. Нет строки — действует общая выдача. Строка с истиной включает, строка с ложью снимает. После перевода в другую РРС строки прежней РРС не читаются.';

COMMENT ON COLUMN manager_branch_grants.permission_code IS
    'branch.access открывает кабинет филиала. branch.roles:write, branch.brigades:write и branch.shared:write — настройки филиала.';

COMMENT ON COLUMN manager_branch_grants.allowed IS
    'Истина включает отметку, ложь снимает. Нет строки — действует общая выдача этой РРС. Общая выдача по умолчанию выключена.';

CREATE TABLE IF NOT EXISTS manager_grant_policies (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL,
    updated_by VARCHAR(100) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, permission_code),
    CONSTRAINT manager_grant_policies_code_check CHECK (
        permission_code IN (
            'branch.access',
            'branch.roles:write',
            'branch.brigades:write',
            'branch.shared:write'
        )
    ),
    CONSTRAINT manager_grant_policies_enabled_check CHECK (enabled)
);

COMMENT ON TABLE manager_grant_policies IS
    'Общая выдача доступа внутри РРС. Включённая отметка действует для всех текущих и новых управляющих, заместителей и старших продавцов, пока у сотрудника нет личной строки.';

COMMENT ON COLUMN manager_grant_policies.permission_code IS
    'branch.access открывает все кабинеты РРС. Остальные коды включают настройку на филиалах, куда у сотрудника есть доступ.';

COMMENT ON COLUMN manager_grant_policies.enabled IS
    'Истина включает отметку для всех. Выключенная общая выдача не хранится.';

COMMENT ON COLUMN manager_grant_policies.updated_by IS
    'Кто последним включил общую выдачу.';
