ALTER TABLE roles ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS scope_kind VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

UPDATE roles
SET code = 'admin',
    name = 'Администратор',
    description = 'Полный доступ. Новые права подхватываются сами.',
    scope_kind = 'division',
    is_system = true
WHERE lower(name) = 'admin' OR code = 'admin';

UPDATE roles
SET code = 'guest',
    name = 'Гость',
    scope_kind = 'none',
    is_system = false
WHERE lower(name) = 'guest' AND (code IS NULL OR btrim(code) = '' OR code = 'guest');

UPDATE roles
SET code = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '_', 'g'))
WHERE code IS NULL OR btrim(code) = '';

ALTER TABLE roles ALTER COLUMN code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS roles_code_uidx ON roles (code);

ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_scope_kind_check;
ALTER TABLE roles
    ADD CONSTRAINT roles_scope_kind_check
    CHECK (scope_kind IN ('division', 'granted', 'home_branch', 'none'));

CREATE TABLE IF NOT EXISTS role_permission_codes (
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL,
    PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE IF NOT EXISTS role_rules (
    id SERIAL PRIMARY KEY,
    priority INTEGER NOT NULL,
    match_type VARCHAR(10) NOT NULL CHECK (match_type IN ('login', 'title')),
    match_value VARCHAR(255) NOT NULL,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (match_type, match_value)
);

INSERT INTO role_rules (priority, match_type, match_value, role_id, expires_at)
SELECT 100, 'login', username, role_id, expires_at
FROM user_role_exceptions
ON CONFLICT (match_type, match_value) DO NOTHING;

INSERT INTO role_rules (priority, match_type, match_value, role_id)
SELECT 10, 'title', ldap_position, role_id
FROM ldap_position_mappings
ON CONFLICT (match_type, match_value) DO NOTHING;

CREATE TABLE IF NOT EXISTS territories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    ldap_login VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    title VARCHAR(255),
    branch_code VARCHAR(50),
    branch_name VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS scope_grants (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    territory_id INTEGER NOT NULL REFERENCES territories(id) ON DELETE CASCADE,
    UNIQUE (username, territory_id)
);

CREATE TABLE IF NOT EXISTS audit_events (
    id SERIAL PRIMARY KEY,
    actor_username VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (name, code, description, scope_kind, is_system)
VALUES
    ('Поддержка', 'support', 'Сумма и состав любой премии', 'division', false),
    ('Линейный сотрудник', 'linear', 'Роль по умолчанию для сотрудника из справочника', 'home_branch', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'bonus.any:read'
FROM roles
WHERE code = 'support'
ON CONFLICT DO NOTHING;
