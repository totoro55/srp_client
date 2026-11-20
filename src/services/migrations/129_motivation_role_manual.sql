-- Ручной выбор роли мотивации можно запретить.
-- Выключенный признак оставляет роль только правилу.
-- Право branch.any-role:write этот запрет снимает и есть у администратора само, без строки в матрице.

ALTER TABLE motivation_roles
    ADD COLUMN IF NOT EXISTS manual_allowed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN motivation_roles.manual_allowed IS
    'Можно выбрать роль вручную на филиале. Выключено — роль ставит только правило.';

COMMENT ON TABLE motivation_roles IS
    'Роли мотивации филиала. Правило подставляет роль. Ручной выбор на филиале зависит от manual_allowed.';
