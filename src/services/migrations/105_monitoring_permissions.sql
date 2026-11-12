-- Отдельные права мониторинга.
-- Запуск пересчёта больше не следует из просмотра филиала или настроек РРС.
-- Запись времени пересчётов больше не следует из настроек РРС.
-- Роли, которым эти действия уже были доступны, сохраняют их отдельной галочкой.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'recalc:write'
FROM role_permission_codes
WHERE permission_code IN ('baskets:connect', 'branch:read')
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'recalc-schedule:write'
FROM role_permission_codes
WHERE permission_code = 'baskets:connect'
ON CONFLICT DO NOTHING;
