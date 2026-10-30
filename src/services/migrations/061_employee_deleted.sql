-- Пометка удаления сотрудника приходит с загрузкой справочника.
-- В выборе для нового правила, упоминания и назначения такую запись не показываем.
-- Уже сохранённые имя и правило по этому логину остаются.

ALTER TABLE dictionaries.employees
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN dictionaries.employees.deleted IS
    'Пометка удаления. Приходит с загрузкой справочника.';
