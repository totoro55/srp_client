-- Роли, сохранённые до месячного среза, лежали на первом месяце штатного расписания.
-- Следующий месяц, где сотрудник всё ещё на этом филиале, получает свой срез с той же ролью.
-- Месяц без строки сотрудника отдельный срез не получает.

INSERT INTO branch_motivation_roles (branch_uuid, employee_uuid, period, role_id, automatic)
SELECT source.branch_uuid,
       source.employee_uuid,
       staff.period,
       source.role_id,
       source.automatic
FROM (
    SELECT DISTINCT ON (lower(branch_uuid), lower(employee_uuid))
           branch_uuid,
           employee_uuid,
           period,
           role_id,
           automatic
    FROM branch_motivation_roles
    ORDER BY lower(branch_uuid), lower(employee_uuid), period
) source
JOIN (
    SELECT DISTINCT period,
           lower(branch_uuid) AS branch,
           lower(employees_uuid::text) AS employee
    FROM raw.hr_ktu
) staff
  ON staff.branch = lower(source.branch_uuid)
 AND staff.employee = lower(source.employee_uuid)
 AND staff.period > source.period
WHERE NOT EXISTS (
    SELECT 1
    FROM branch_motivation_roles existing
    WHERE lower(existing.branch_uuid) = staff.branch
      AND lower(existing.employee_uuid) = staff.employee
      AND existing.period = staff.period
);
