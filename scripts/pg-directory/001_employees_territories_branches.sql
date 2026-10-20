-- Справочники. Наполняет загрузка данных, приложение их только читает.
-- Живут в схеме dictionaries той же базы. Миграция приложения переносит
-- уже созданные таблицы из public, если загрузка успела положить их туда.
--
-- Ожидаемые колонки со стороны приложения:
--   employees:   uuid, login, name, title, branch
--   territories: uuid, code, name

CREATE SCHEMA IF NOT EXISTS dictionaries;

CREATE TABLE IF NOT EXISTS dictionaries.territories (
    uuid UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT territories_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS territories_name_idx ON dictionaries.territories (name);

CREATE TABLE IF NOT EXISTS dictionaries.branches (
    uuid UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    territory_uuid UUID REFERENCES dictionaries.territories (uuid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT branches_code_unique UNIQUE (code),
    CONSTRAINT branches_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS branches_territory_uuid_idx ON dictionaries.branches (territory_uuid);
CREATE INDEX IF NOT EXISTS branches_name_idx ON dictionaries.branches (name);

CREATE TABLE IF NOT EXISTS dictionaries.employees (
    uuid UUID PRIMARY KEY,
    login VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    -- Текст, как его читает приложение (подпись филиала), совпадает с branches.name.
    branch VARCHAR(255),
    branch_uuid UUID REFERENCES dictionaries.branches (uuid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS employees_login_uidx ON dictionaries.employees (lower(login));
CREATE INDEX IF NOT EXISTS employees_branch_uuid_idx ON dictionaries.employees (branch_uuid);
CREATE INDEX IF NOT EXISTS employees_title_idx ON dictionaries.employees (title);
