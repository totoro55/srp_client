-- Кабинеты и детализация назначаются галочками матрицы, а не кодом роли.
-- Сотрудник: свой филиал и детализация общей премии.
-- Управляющий: ещё выданные территории и чужая детализация.
-- Администрация РРС: ещё своя территория и чужая детализация.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'bonus.shared:read'
FROM roles
WHERE code IN ('linear', 'store-manager', 'rrs-director')
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, permission.permission_code
FROM roles
CROSS JOIN (
    VALUES ('bonus.granted:read'), ('bonus.detail:read')
) AS permission(permission_code)
WHERE code = 'store-manager'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, permission.permission_code
FROM roles
CROSS JOIN (
    VALUES ('bonus.territory:read'), ('bonus.detail:read')
) AS permission(permission_code)
WHERE code = 'rrs-director'
ON CONFLICT DO NOTHING;
