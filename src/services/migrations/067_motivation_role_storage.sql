-- Справочник ролей мотивации, правила по должности и ручные назначения на филиале.
-- Нет строки в branch_motivation_roles — роль берётся из правила.
-- role_id NULL — роль снята вручную. Удаление роли не стирает такие назначения.

CREATE TABLE IF NOT EXISTS motivation_roles (
    id text PRIMARY KEY,
    title text NOT NULL,
    sort_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS motivation_role_rules (
    id text PRIMARY KEY,
    title text NOT NULL,
    ktu text NOT NULL CHECK (ktu IN ('plus', 'minus', 'any')),
    role_id text NULL REFERENCES motivation_roles (id) ON DELETE RESTRICT,
    sort_order integer NOT NULL
);

CREATE TABLE IF NOT EXISTS branch_motivation_roles (
    branch_uuid text NOT NULL,
    employee_uuid text NOT NULL,
    role_id text NULL REFERENCES motivation_roles (id) ON DELETE RESTRICT,
    PRIMARY KEY (branch_uuid, employee_uuid)
);

CREATE INDEX IF NOT EXISTS branch_motivation_roles_branch_idx
    ON branch_motivation_roles (lower(branch_uuid));

COMMENT ON TABLE motivation_roles IS
    'Роли мотивации филиала. Их выбирают вручную и подставляют в правила.';

COMMENT ON COLUMN motivation_roles.id IS
    'Код роли латиницей, например usm.';

COMMENT ON COLUMN motivation_roles.title IS
    'Подпись роли, например УСМ.';

COMMENT ON COLUMN motivation_roles.sort_order IS
    'Порядок в списках выбора.';

COMMENT ON TABLE motivation_role_rules IS
    'Правила автоматической роли. Срабатывает первое подходящее: должность и КТУ.';

COMMENT ON COLUMN motivation_role_rules.title IS
    'Должность из штатного расписания. Сравнение без учёта регистра.';

COMMENT ON COLUMN motivation_role_rules.ktu IS
    'plus, minus или any. any подходит и при пустом КТУ.';

COMMENT ON COLUMN motivation_role_rules.role_id IS
    'Роль по правилу. Пусто — правило оставляет сотрудника без роли.';

COMMENT ON COLUMN motivation_role_rules.sort_order IS
    'Порядок проверки. Меньшее значение проверяется раньше.';

COMMENT ON TABLE branch_motivation_roles IS
    'Ручная роль сотрудника на филиале. Нет строки — роль из правила. role_id NULL — роль снята вручную.';

COMMENT ON COLUMN branch_motivation_roles.branch_uuid IS
    'Филиал. Uuid текстом, в нижнем регистре. Без связи со справочником филиалов.';

COMMENT ON COLUMN branch_motivation_roles.employee_uuid IS
    'Сотрудник. Uuid текстом, как в штатном расписании. Без связи со справочником сотрудников.';

COMMENT ON COLUMN branch_motivation_roles.role_id IS
    'Назначенная роль. Пусто — явное снятие роли.';

INSERT INTO motivation_roles (id, title, sort_order) VALUES
    ('usm', 'УСМ', 0),
    ('svm', 'СВМ', 1),
    ('keeper', 'Кладовщик', 2),
    ('merchandiser', 'Мерчендайзер', 3)
ON CONFLICT (id) DO NOTHING;

INSERT INTO motivation_role_rules (id, title, ktu, role_id, sort_order) VALUES
    ('issuance', 'Сотрудник выдачи магазина', 'any', 'svm', 0),
    ('keeper', 'Кладовщик', 'any', 'keeper', 1),
    ('store-plus', 'Универсальный сотрудник магазина', 'plus', 'usm', 2),
    ('store-minus', 'Универсальный сотрудник магазина', 'minus', NULL, 3)
ON CONFLICT (id) DO NOTHING;
