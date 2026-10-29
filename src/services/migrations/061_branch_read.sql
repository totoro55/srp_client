-- Просмотр филиала: настройки, премии и детализация.
-- Роли, которым уже открыты настройки РРС, получают это право в матрице.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'branch:read'
FROM role_permission_codes
WHERE permission_code = 'baskets:connect'
ON CONFLICT DO NOTHING;
