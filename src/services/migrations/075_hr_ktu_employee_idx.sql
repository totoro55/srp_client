-- Поиск филиала сотрудника на дату документа: последняя строка не позже этой даты.
-- Повторный запуск не пересоздаёт индекс.

CREATE INDEX IF NOT EXISTS hr_ktu_employee_modified_idx
    ON raw.hr_ktu (lower(employees_uuid), date_modified DESC);

COMMENT ON INDEX raw.hr_ktu_employee_modified_idx IS
    'Филиал сотрудника на дату: последняя date_modified не позже этой даты.';
