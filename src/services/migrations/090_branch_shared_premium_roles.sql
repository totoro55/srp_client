-- Роли филиала, между которыми делится общая премия.
-- Нет строк филиала — доля есть у каждого, кто в расчёте.
-- Строки есть — доля только у этих ролей. Роль может быть ручной или автоматической.

CREATE TABLE IF NOT EXISTS branch_shared_premium_roles (
    branch_uuid TEXT NOT NULL,
    role_id TEXT NOT NULL REFERENCES motivation_roles (id) ON DELETE CASCADE,
    PRIMARY KEY (branch_uuid, role_id)
);

COMMENT ON TABLE branch_shared_premium_roles IS
    'Роли филиала, между которыми делится общая премия. Нет строк — премия делится между всеми, кто в расчёте.';

COMMENT ON COLUMN branch_shared_premium_roles.branch_uuid IS
    'Филиал. Uuid текстом, в нижнем регистре.';

COMMENT ON COLUMN branch_shared_premium_roles.role_id IS
    'Роль получателя доли. Учитывается и ручное назначение, и роль из правила.';
