-- Идентификатор, который лежал текстом, хранится как uuid.
-- Пустая строка становится NULL. Колонка, которая уже uuid, не переписывается.
-- firm_uuid, графики и промоутеры и так uuid.

DROP INDEX IF EXISTS raw.hr_ktu_employee_modified_idx;
DROP INDEX IF EXISTS raw.sale_period_author_idx;
DROP INDEX IF EXISTS raw.sale_period_author2_idx;
DROP INDEX IF EXISTS raw.kassa_oper_period_author_idx;
DROP INDEX IF EXISTS branch_motivation_roles_branch_idx;
DROP INDEX IF EXISTS branch_motivation_roles_slice_idx;

-- Индекс по lower/btrim не даёт сменить тип. Обычный индекс PostgreSQL пересобирает сам.
DO $$
DECLARE
    dependent regclass;
BEGIN
    FOR dependent IN
        SELECT indexrelid::regclass
        FROM pg_index
        JOIN pg_class tbl ON tbl.oid = pg_index.indrelid
        JOIN pg_namespace nsp ON nsp.oid = tbl.relnamespace
        WHERE nsp.nspname IN ('raw', 'public', 'main')
          AND tbl.relname IN (
              'hr_ktu', 'sale', 'kassa_oper', 'branch_motivation_roles',
              'branch_shared_premium_roles', 'author_days', 'premium_accruals',
              'basket_premium_days', 'shared_premiums', 'shared_premium_authors'
          )
          AND NOT indisprimary
          AND pg_get_indexdef(indexrelid) ~* 'lower\(|btrim\('
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %s', dependent);
    END LOOP;
END $$;

DROP VIEW IF EXISTS main.sale_premium_employees;
DROP VIEW IF EXISTS main.sale_premium_branches;
DROP VIEW IF EXISTS main.sale_premium_territories;

DO $$
DECLARE
    target record;
BEGIN
    FOR target IN
        SELECT wanted.schema_name, wanted.table_name, wanted.column_name
        FROM (VALUES
            ('raw', 'hr_ktu', 'employees_uuid'),
            ('raw', 'hr_ktu', 'branch_uuid'),
            ('raw', 'sale', 'author'),
            ('raw', 'sale', 'author2'),
            ('raw', 'sale', 'kinde'),
            ('raw', 'sale', 'category'),
            ('raw', 'kassa_oper', 'author'),
            ('raw', 'kassa_oper', 'Фирма'),
            ('public', 'branch_motivation_roles', 'branch_uuid'),
            ('public', 'branch_motivation_roles', 'employee_uuid'),
            ('public', 'branch_shared_premium_roles', 'branch_uuid'),
            ('main', 'author_days', 'employee_uuid'),
            ('main', 'premium_accruals', 'employee_uuid'),
            ('main', 'basket_premium_days', 'employee_uuid'),
            ('main', 'shared_premiums', 'employee_uuid'),
            ('main', 'shared_premium_authors', 'employee_uuid')
        ) AS wanted(schema_name, table_name, column_name)
        JOIN information_schema.columns live
            ON live.table_schema = wanted.schema_name
           AND live.table_name = wanted.table_name
           AND live.column_name = wanted.column_name
           AND live.udt_name IN ('text', 'varchar')
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ALTER COLUMN %I TYPE uuid USING NULLIF(btrim(%I), '''')::uuid',
            target.schema_name,
            target.table_name,
            target.column_name,
            target.column_name
        );
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS hr_ktu_employee_modified_idx
    ON raw.hr_ktu (employees_uuid, date_modified DESC);

CREATE INDEX IF NOT EXISTS sale_period_author_idx
    ON raw.sale (period, author);

CREATE INDEX IF NOT EXISTS sale_period_author2_idx
    ON raw.sale (period, author2)
    WHERE author2 IS NOT NULL;

CREATE INDEX IF NOT EXISTS kassa_oper_period_author_idx
    ON raw.kassa_oper ("period", author);

CREATE INDEX IF NOT EXISTS branch_motivation_roles_branch_idx
    ON branch_motivation_roles (branch_uuid);

CREATE INDEX IF NOT EXISTS branch_motivation_roles_slice_idx
    ON branch_motivation_roles (branch_uuid, employee_uuid, period DESC);

COMMENT ON COLUMN raw.hr_ktu.employees_uuid IS
    'Сотрудник.';

COMMENT ON COLUMN raw.hr_ktu.branch_uuid IS
    'Филиал.';

COMMENT ON COLUMN raw.sale.author IS
    'Кто продал.';

COMMENT ON COLUMN raw.sale.author2 IS
    'Кто выдал.';

COMMENT ON COLUMN raw.sale.kinde IS
    'Вид изделия.';

COMMENT ON COLUMN raw.sale.category IS
    'Категория.';

COMMENT ON COLUMN raw.kassa_oper.author IS
    'Автор операции.';

COMMENT ON COLUMN raw.kassa_oper."Фирма" IS
    'Филиал документа. Для автокассы и терминала это филиал премии. Для сотрудника филиал берётся из штатного расписания.';

COMMENT ON COLUMN branch_motivation_roles.branch_uuid IS
    'Филиал. Без связи со справочником филиалов.';

COMMENT ON COLUMN branch_motivation_roles.employee_uuid IS
    'Сотрудник. Без связи со справочником сотрудников.';

COMMENT ON COLUMN branch_shared_premium_roles.branch_uuid IS
    'Филиал.';

COMMENT ON COLUMN main.author_days.employee_uuid IS
    'Автор дня: сотрудник, промоутер или системная учётка.';

COMMENT ON COLUMN main.premium_accruals.employee_uuid IS
    'Сотрудник.';

COMMENT ON COLUMN main.basket_premium_days.employee_uuid IS
    'Сотрудник.';

COMMENT ON COLUMN main.shared_premiums.employee_uuid IS
    'Сотрудник.';

COMMENT ON COLUMN main.shared_premium_authors.employee_uuid IS
    'Автор вклада: сотрудник, промоутер или системная учётка.';

CREATE VIEW main.sale_premium_employees AS
SELECT day.period,
       day.territory_uuid,
       day.branch_uuid,
       day.employee_uuid,
       SUM(day.premium) AS premium,
       COUNT(*)::bigint AS lines
FROM main.basket_premium_days day
JOIN baskets basket ON basket.id = day.basket_id
JOIN indicators indicator ON indicator.id = basket.indicator_id
WHERE indicator.name = 'Продажа товара'
GROUP BY day.period, day.territory_uuid, day.branch_uuid, day.employee_uuid;

COMMENT ON VIEW main.sale_premium_employees IS
    'Премия за продажу сотрудника на филиале за месяц. lines — число дней, а не строк товаров.';

CREATE VIEW main.sale_premium_branches AS
SELECT day.period,
       day.territory_uuid,
       day.branch_uuid,
       SUM(day.premium) AS premium,
       COUNT(DISTINCT day.employee_uuid)::bigint AS employees
FROM main.basket_premium_days day
JOIN baskets basket ON basket.id = day.basket_id
JOIN indicators indicator ON indicator.id = basket.indicator_id
WHERE indicator.name = 'Продажа товара'
GROUP BY day.period, day.territory_uuid, day.branch_uuid;

COMMENT ON VIEW main.sale_premium_branches IS
    'Премия за продажу филиала за месяц.';

CREATE VIEW main.sale_premium_territories AS
SELECT day.period,
       day.territory_uuid,
       SUM(day.premium) AS premium,
       COUNT(DISTINCT day.branch_uuid)::bigint AS branches
FROM main.basket_premium_days day
JOIN baskets basket ON basket.id = day.basket_id
JOIN indicators indicator ON indicator.id = basket.indicator_id
WHERE indicator.name = 'Продажа товара'
GROUP BY day.period, day.territory_uuid;

COMMENT ON VIEW main.sale_premium_territories IS
    'Премия за продажу РРС за месяц.';
