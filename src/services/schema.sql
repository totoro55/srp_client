
-- 1. Таблица системных ролей безопасности
CREATE TABLE IF NOT EXISTS roles (
                                     id SERIAL PRIMARY KEY,
                                     name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 2. Таблица защищаемых роутов приложения
CREATE TABLE IF NOT EXISTS permissions (
                                           id SERIAL PRIMARY KEY,
                                           route_path VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL DEFAULT 'ALL',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(route_path, method)
    );

-- 3. Матрица доступов (Связи Роли <-> Разрешения)
CREATE TABLE IF NOT EXISTS role_permissions (
                                                role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
    );

-- 4. Соответствие кадровых должностей Active Directory системным ролям
CREATE TABLE IF NOT EXISTS ldap_position_mappings (
                                                      id SERIAL PRIMARY KEY,
                                                      ldap_position VARCHAR(255) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 5. Индивидуальные исключения ИБ для конкретных сотрудников
CREATE TABLE IF NOT EXISTS user_role_exceptions (
                                                    id SERIAL PRIMARY KEY,
                                                    username VARCHAR(100) UNIQUE NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- 6. Сиды базовых системных ролей по умолчанию
INSERT INTO roles (name, description)
VALUES
    ('ADMIN', 'Полный доступ ко всей системе и панели безопасности ИБ'),
    ('GUEST', 'Гостевой доступ: разрешены только общедоступные страницы')
    ON CONFLICT (name) DO NOTHING;

-- 7. Сид базового общедоступного роута для роли GUEST
INSERT INTO permissions (route_path, method, description)
VALUES ('/', 'GET', 'Главная страница приложения')
    ON CONFLICT (route_path, method) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'GUEST' AND p.route_path = '/' AND p.method = 'GET'
    ON CONFLICT DO NOTHING;
