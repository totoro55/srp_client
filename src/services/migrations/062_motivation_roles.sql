-- Роли мотивации: справочник и правила по должности.
-- Роли, которым уже можно менять корзины, получают просмотр и изменение.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, granted.permission_code
FROM role_permission_codes
CROSS JOIN (VALUES ('motivation-roles:read'), ('motivation-roles:write')) AS granted(permission_code)
WHERE role_permission_codes.permission_code = 'baskets:write'
ON CONFLICT DO NOTHING;
