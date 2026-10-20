-- Карточка человека, который хотя бы раз прошёл LDAP.
-- Права по-прежнему считаются из role_rules на каждый запрос.
-- object_guid — стабильный идентификатор Active Directory; логин может смениться.

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    object_guid UUID UNIQUE,
    username VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    department VARCHAR(255),
    title VARCHAR(255) NOT NULL DEFAULT '',
    first_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx ON users (lower(username));

CREATE TABLE IF NOT EXISTS login_events (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL,
    ip VARCHAR(64),
    user_agent VARCHAR(512),
    title VARCHAR(255),
    department VARCHAR(255),
    access_source VARCHAR(20),
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    role_name VARCHAR(100),
    title_changed BOOLEAN NOT NULL DEFAULT false,
    failure_reason VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT login_events_access_source_check CHECK (
        access_source IS NULL
        OR access_source IN ('dev', 'login_rule', 'title_rule', 'linear', 'none', 'conflict')
    ),
    CONSTRAINT login_events_failure_reason_check CHECK (
        failure_reason IS NULL
        OR failure_reason IN ('not_found', 'invalid_credentials', 'unavailable')
    )
);

CREATE INDEX IF NOT EXISTS login_events_user_created_idx ON login_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_created_at_idx ON login_events (created_at DESC);
CREATE INDEX IF NOT EXISTS login_events_failures_idx ON login_events (created_at DESC) WHERE success = false;

COMMENT ON TABLE users IS
    'Люди, которые входили в приложение. Учётная запись и пароль остаются в LDAP.';
COMMENT ON TABLE login_events IS
    'Успешные входы и отказы: время, адрес, браузер, должность и источник роли на этот момент.';
