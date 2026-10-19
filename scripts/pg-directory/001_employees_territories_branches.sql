-- Справочники для отдельной базы PostgreSQL (наполняет загрузка данных).
-- Приложение их только читает и эти таблицы своими миграциями не создаёт.
--
-- Ожидаемые колонки со стороны приложения:
--   employees:   uuid, login, name, title, branch
--   territories: uuid, code, name

CREATE TABLE IF NOT EXISTS territories (
    uuid UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT territories_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS territories_name_idx ON territories (name);

CREATE TABLE IF NOT EXISTS branches (
    uuid UUID PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    territory_uuid UUID REFERENCES territories (uuid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT branches_code_unique UNIQUE (code),
    CONSTRAINT branches_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS branches_territory_uuid_idx ON branches (territory_uuid);
CREATE INDEX IF NOT EXISTS branches_name_idx ON branches (name);

CREATE TABLE IF NOT EXISTS employees (
    uuid UUID PRIMARY KEY,
    login VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    -- Текст, как его читает приложение (подпись филиала), совпадает с branches.name.
    branch VARCHAR(255),
    branch_uuid UUID REFERENCES branches (uuid) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS employees_login_uidx ON employees (lower(login));
CREATE INDEX IF NOT EXISTS employees_branch_uuid_idx ON employees (branch_uuid);
CREATE INDEX IF NOT EXISTS employees_title_idx ON employees (title);
