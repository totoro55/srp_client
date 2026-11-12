-- Промоутеры месяца. Таблицу заполняют снаружи, приложение только читает.
-- В справочник сотрудников и в штатное расписание эти люди не входят.
-- Строка без uuid или имени в расчёт не берётся.
-- Строка действует с date_modified до следующей такой даты, как в raw.hr_ktu.

CREATE TABLE IF NOT EXISTS raw.hr_ktu_promouter (
    period DATE NULL,
    employees_uuid UUID NULL,
    name_employees TEXT NULL,
    title TEXT NULL,
    branch_uuid UUID NULL,
    date_modified DATE NULL
);

COMMENT ON TABLE raw.hr_ktu_promouter IS
    'Промоутеры. Заполняется снаружи. Нужны только для общей премии филиала. Строка без uuid или имени не считается.';

COMMENT ON COLUMN raw.hr_ktu_promouter.period IS
    'Месяц выгрузки, первое число.';

COMMENT ON COLUMN raw.hr_ktu_promouter.employees_uuid IS
    'Промоутер. Пустой uuid в расчёт не входит.';

COMMENT ON COLUMN raw.hr_ktu_promouter.name_employees IS
    'Имя промоутера. Пустое имя в расчёт не входит.';

COMMENT ON COLUMN raw.hr_ktu_promouter.title IS
    'Должность. Обычно «Промоутер».';

COMMENT ON COLUMN raw.hr_ktu_promouter.branch_uuid IS
    'Филиал, на котором промоутер числился с date_modified.';

COMMENT ON COLUMN raw.hr_ktu_promouter.date_modified IS
    'Дата версии строки. Действует до следующей такой даты, в том числе из предыдущего месяца.';

CREATE INDEX IF NOT EXISTS hr_ktu_promouter_employee_date_idx
    ON raw.hr_ktu_promouter (employees_uuid, date_modified DESC);

CREATE INDEX IF NOT EXISTS hr_ktu_promouter_branch_date_idx
    ON raw.hr_ktu_promouter (branch_uuid, date_modified);
