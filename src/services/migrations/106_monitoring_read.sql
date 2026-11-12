-- Просмотр мониторинга отделён от просмотра корзин.
-- Роли, которым мониторинг уже был виден, сохраняют его отдельной галочкой.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'monitoring:read'
FROM role_permission_codes
WHERE permission_code = 'baskets:read'
ON CONFLICT DO NOTHING;
