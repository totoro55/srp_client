-- Премия хранится по дню документа, а не по строке товара.
-- Начисление задаёт сотрудника и отрезок дат. Пока таблица пустая, пересчёт не пропускает дни.
-- Повторный запуск не пересоздаёт таблицы. Старые снимки строк удаляются один раз.

DROP VIEW IF EXISTS main.sale_premium_territories;
DROP VIEW IF EXISTS main.sale_premium_branches;
DROP VIEW IF EXISTS main.sale_premium_employees;
DROP TABLE IF EXISTS main.sale_premium_lines;
DROP TABLE IF EXISTS main.release_premium_lines;

CREATE TABLE IF NOT EXISTS main.premium_accruals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period DATE NOT NULL,
    employee_uuid TEXT NOT NULL,
    branch_uuid UUID,
    active_from DATE NOT NULL,
    active_until DATE NOT NULL,
    accrued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT premium_accruals_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT premium_accruals_interval CHECK (active_from <= active_until)
);

CREATE INDEX IF NOT EXISTS premium_accruals_employee_idx
    ON main.premium_accruals (period, employee_uuid, active_from, active_until);

COMMENT ON TABLE main.premium_accruals IS
    'Отрезок сотрудника, по которому зарплата уже начислена. Пересчёт премии не меняет дни внутри отрезка. Строки появятся вместе с начислением.';

COMMENT ON COLUMN main.premium_accruals.employee_uuid IS
    'Сотрудник. Текст в нижнем регистре, как в расчёте премии.';

COMMENT ON COLUMN main.premium_accruals.branch_uuid IS
    'Филиал отрезка по штатному расписанию. Пусто — отрезок закрывает все филиалы сотрудника на эти даты.';

COMMENT ON COLUMN main.premium_accruals.active_from IS
    'Первый день отрезка, включительно.';

COMMENT ON COLUMN main.premium_accruals.active_until IS
    'Последний день отрезка, включительно.';

CREATE TABLE IF NOT EXISTS main.premium_accrual_coefficients (
    accrual_id BIGINT NOT NULL REFERENCES main.premium_accruals (id) ON DELETE CASCADE,
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    coefficient_key VARCHAR(50) NOT NULL,
    value NUMERIC NOT NULL,
    PRIMARY KEY (accrual_id, basket_id, coefficient_key)
);

COMMENT ON TABLE main.premium_accrual_coefficients IS
    'Коэффициенты, которыми посчитан закрытый отрезок. Детализация читает их вместо текущих значений филиала. Пишется вместе с начислением.';

COMMENT ON COLUMN main.premium_accrual_coefficients.coefficient_key IS
    'Ключ коэффициента версии: для продажи sale_coef, stm_coef, not_stm_coef, b2b_coef, im_coef; для выдачи release_coef.';

COMMENT ON COLUMN main.premium_accrual_coefficients.value IS
    'Значение, которое вошло в формулу. Отсутствие ключа в живом расчёте по-прежнему означает единицу.';

CREATE TABLE IF NOT EXISTS main.basket_premium_days (
    period DATE NOT NULL,
    territory_uuid UUID NOT NULL,
    branch_uuid UUID NOT NULL,
    employee_uuid TEXT NOT NULL,
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    day DATE NOT NULL,
    premium NUMERIC(18, 2) NOT NULL,
    accrual_id BIGINT REFERENCES main.premium_accruals (id) ON DELETE SET NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (period, basket_id, branch_uuid, employee_uuid, day),
    CONSTRAINT basket_premium_days_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_premium_days_branch_idx
    ON main.basket_premium_days (period, branch_uuid, employee_uuid);

COMMENT ON TABLE main.basket_premium_days IS
    'Сумма премии за день документа. Филиал — филиал сотрудника по штатному расписанию. Строки товаров здесь не хранятся.';

COMMENT ON COLUMN main.basket_premium_days.day IS
    'Дата документа. Премия строк этого дня округлена до копеек и сложена.';

COMMENT ON COLUMN main.basket_premium_days.premium IS
    'Сумма премии за день, в копейках.';

COMMENT ON COLUMN main.basket_premium_days.accrual_id IS
    'Начисление, которое закрыло этот день. Пусто — день можно пересчитать.';

CREATE OR REPLACE VIEW main.sale_premium_employees AS
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

CREATE OR REPLACE VIEW main.sale_premium_branches AS
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

CREATE OR REPLACE VIEW main.sale_premium_territories AS
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
