-- Просмотр штатного расписания.
-- Роли, которым уже видны роли мотивации, сохраняют этот экран.

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'staffing:read'
FROM role_permission_codes
WHERE permission_code = 'motivation-roles:read'
ON CONFLICT DO NOTHING;
