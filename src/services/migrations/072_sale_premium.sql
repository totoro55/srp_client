-- Снимок премии за продажу. Кабинет читает сумму отсюда.
-- Если совсем старый период уберут из raw.sale, сумма остаётся, детализации уже нет.
-- Месяц пересчитывается целиком. Закрытый месяц расчёт не трогает.
-- Повторный запуск не пересоздаёт таблицу.

CREATE TABLE IF NOT EXISTS main.sale_premium_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period DATE NOT NULL,
    territory_uuid UUID NOT NULL,
    branch_uuid UUID NOT NULL,
    employee_uuid TEXT NOT NULL,
    version_id INTEGER NOT NULL,
    axis VARCHAR(20) NOT NULL,
    code TEXT NOT NULL,
    channel VARCHAR(20) NOT NULL,
    base_mode VARCHAR(20) NOT NULL,
    tariff NUMERIC NOT NULL,
    price DOUBLE PRECISION,
    item_count DOUBLE PRECISION NOT NULL,
    sale_coef NUMERIC NOT NULL,
    b2b_coef NUMERIC NOT NULL,
    premium NUMERIC(18, 2) NOT NULL,
    link_doc TEXT,
    document_number TEXT,
    document_date TIMESTAMP,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sale_premium_lines_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT sale_premium_lines_axis_check CHECK (axis IN ('category', 'product_kind')),
    CONSTRAINT sale_premium_lines_channel_check CHECK (channel IN ('main', 'b2b')),
    CONSTRAINT sale_premium_lines_mode_check CHECK (base_mode IN ('percent', 'per_unit'))
);

CREATE INDEX IF NOT EXISTS sale_premium_lines_branch_idx
    ON main.sale_premium_lines (period, branch_uuid, employee_uuid);

CREATE INDEX IF NOT EXISTS sale_premium_lines_territory_idx
    ON main.sale_premium_lines (period, territory_uuid);

COMMENT ON TABLE main.sale_premium_lines IS
    'Строка премии за продажу. Считается по подключённой версии 2 или 3. Остаётся, если совсем старый период уберут из raw.sale.';

COMMENT ON COLUMN main.sale_premium_lines.channel IS
    'main — розница, b2b — безнал. Канал интернет-магазина появится отдельным условием.';

COMMENT ON COLUMN main.sale_premium_lines.premium IS
    'Премия строки. Розница за количество: ставка main × количество × sale_coef. От цены: доля main × цена × количество × sale_coef. Безнал: ставка b2b × количество × b2b_coef × sale_coef.';

CREATE OR REPLACE VIEW main.sale_premium_employees AS
SELECT period,
       territory_uuid,
       branch_uuid,
       employee_uuid,
       SUM(premium) AS premium,
       COUNT(*)::bigint AS lines
FROM main.sale_premium_lines
GROUP BY period, territory_uuid, branch_uuid, employee_uuid;

COMMENT ON VIEW main.sale_premium_employees IS
    'Премия за продажу сотрудника на филиале за месяц.';

CREATE OR REPLACE VIEW main.sale_premium_branches AS
SELECT period,
       territory_uuid,
       branch_uuid,
       SUM(premium) AS premium,
       COUNT(DISTINCT employee_uuid)::bigint AS employees
FROM main.sale_premium_lines
GROUP BY period, territory_uuid, branch_uuid;

COMMENT ON VIEW main.sale_premium_branches IS
    'Премия за продажу филиала за месяц.';

CREATE OR REPLACE VIEW main.sale_premium_territories AS
SELECT period,
       territory_uuid,
       SUM(premium) AS premium,
       COUNT(DISTINCT branch_uuid)::bigint AS branches
FROM main.sale_premium_lines
GROUP BY period, territory_uuid;

COMMENT ON VIEW main.sale_premium_territories IS
    'Премия за продажу РРС за месяц.';
