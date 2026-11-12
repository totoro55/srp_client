-- Просмотр премии филиала отделён от настроек филиала.
-- Управляющий магазина видит текущий филиал и филиалы выданных территорий.
-- Администрация РРС видит филиалы своей территории.
-- Сотрудник видит свой филиал и филиалы, где у него есть премия.

INSERT INTO roles (name, code, description, scope_kind, is_system)
VALUES
    ('Управляющий', 'store-manager', 'Текущий филиал и филиалы выданных территорий. Детализация сотрудников этих филиалов.', 'home_branch', false),
    ('Администрация РРС', 'rrs-director', 'Сотрудники администрации РРС. Филиалы своей территории и детализация их сотрудников.', 'granted', false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'bonus.branch:read'
FROM roles
WHERE code IN ('linear', 'store-manager', 'rrs-director')
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'branch:read'
FROM roles
WHERE code = 'store-manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'bonus.branch:read'
FROM role_permission_codes
WHERE permission_code = 'branch:read'
ON CONFLICT DO NOTHING;

INSERT INTO role_rules (priority, match_type, match_value, role_id)
SELECT 20, 'title', title.name, role.id
FROM (
    VALUES
        ('Управляющий маг.'),
        ('Управляющий маг. средней категории'),
        ('Управляющий маг. высшей категории'),
        ('Управляющий филиала магазин-склад'),
        ('Зам. управляющего магазина')
) AS title(name)
JOIN roles role ON role.code = 'store-manager'
ON CONFLICT (match_type, match_value) DO NOTHING;

INSERT INTO role_rules (priority, match_type, match_value, role_id)
SELECT 20, 'title', 'Директор региональной розничной сети', role.id
FROM roles role
WHERE role.code = 'rrs-director'
ON CONFLICT (match_type, match_value) DO NOTHING;
