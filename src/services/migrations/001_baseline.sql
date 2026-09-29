CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    route_path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'ALL',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_path, method)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS ldap_position_mappings (
    id SERIAL PRIMARY KEY,
    ldap_position VARCHAR(255) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_role_exceptions (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    reason TEXT,
    granted_by VARCHAR(100),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description)
VALUES
    ('ADMIN', 'Полный доступ ко всей системе и панели безопасности ИБ'),
    ('GUEST', 'Гостевой доступ: разрешены только общедоступные страницы')
ON CONFLICT (name) DO NOTHING;
