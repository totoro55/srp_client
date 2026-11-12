-- Кабинет, тарифы и настройки филиала больше не открываются одним правом.
-- Роли, бригады и общая премия настраиваются отдельно.
-- Кто уже мог открыть настройки или тарифы филиала, сохраняет эти действия.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT source.role_id, permission.permission_code
FROM role_permission_codes source
CROSS JOIN (
    VALUES
        ('branch.tariffs:read'),
        ('branch.roles:write'),
        ('branch.brigades:write'),
        ('branch.shared:write')
) AS permission(permission_code)
WHERE source.permission_code IN ('branch:read', 'baskets:connect')
ON CONFLICT DO NOTHING;
