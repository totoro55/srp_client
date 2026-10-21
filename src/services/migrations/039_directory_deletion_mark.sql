-- Названия филиала и территории у сотрудника дублируют справочники.
-- Пометка на удаление: в новом периоде такую запись не показываем и не подключаем.

ALTER TABLE dictionaries.employees DROP COLUMN IF EXISTS territory;
ALTER TABLE dictionaries.employees DROP COLUMN IF EXISTS branch;

ALTER TABLE dictionaries.territories
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE dictionaries.branches
    ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE;
