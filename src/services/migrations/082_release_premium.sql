-- Снимок премии за выдачу. Все версии корзины пишут сюда.
-- Месяц версии пересчитывается целиком. Закрытый месяц расчёт не трогает.
-- Повторный запуск не пересоздаёт таблицу.

CREATE TABLE IF NOT EXISTS main.release_premium_lines (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    period DATE NOT NULL,
    territory_uuid UUID NOT NULL,
    branch_uuid UUID NOT NULL,
    employee_uuid TEXT NOT NULL,
    version_id INTEGER NOT NULL,
    category_code TEXT NOT NULL,
    quantity_tariff NUMERIC NOT NULL,
    volume_tariff NUMERIC NOT NULL,
    item_count DOUBLE PRECISION NOT NULL,
    volume DOUBLE PRECISION NOT NULL,
    premium NUMERIC(18, 2) NOT NULL,
    link_doc TEXT,
    document_number TEXT,
    document_date TIMESTAMP,
    product_name TEXT,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT release_premium_lines_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS release_premium_lines_branch_idx
    ON main.release_premium_lines (period, branch_uuid, employee_uuid);

COMMENT ON TABLE main.release_premium_lines IS
    'Строка премии за выдачу. Считается по подключённой версии. Остаётся, если совсем старый период уберут из raw.sale.';

COMMENT ON COLUMN main.release_premium_lines.category_code IS
    'Категория товара из raw.sale. Пустая строка, если в продаже категории не было.';

COMMENT ON COLUMN main.release_premium_lines.quantity_tariff IS
    'Готовый тариф за количество. Ставка quantity уже умножена на коэффициент выдачи филиала.';

COMMENT ON COLUMN main.release_premium_lines.volume_tariff IS
    'Готовый тариф за объём. Ставка volume уже умножена на коэффициент выдачи филиала.';

COMMENT ON COLUMN main.release_premium_lines.premium IS
    'Премия строки, округление до копеек. Готовый тариф количества × количество плюс готовый тариф объёма × объём.';

COMMENT ON COLUMN main.release_premium_lines.product_name IS
    'Название товара из raw.sale. Пусто, если в продаже названия не было.';

COMMENT ON INDEX raw.sale_period_author2_idx IS
    'Строки месяца по второму автору: выдача товара и продажа интернет-магазина.';
