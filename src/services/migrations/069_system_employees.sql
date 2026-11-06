-- Системные записи справочника сотрудников: сайт, доставка, система.
-- Входа под ними нет. Документы проводятся от их имени.
-- В выгрузке у них нули вместо территории и филиала. В таблице это пусто, не нулевой uuid:
-- внешний ключ на филиал и территорию для нуля не выполняется.

ALTER TABLE dictionaries.employees
    ALTER COLUMN territory_uuid DROP NOT NULL,
    ALTER COLUMN branch_uuid DROP NOT NULL;

COMMENT ON COLUMN dictionaries.employees.territory_uuid IS
    'Территория. Пусто у системной записи: сайт, доставка, система. Входа под ней нет.';

COMMENT ON COLUMN dictionaries.employees.branch_uuid IS
    'Филиал. Пусто у системной записи.';

COMMENT ON COLUMN dictionaries.employees.login IS
    'Логин для входа. У системной записи технический и для входа не используется.';
