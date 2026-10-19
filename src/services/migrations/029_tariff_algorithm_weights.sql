-- Веса алгоритмов тарифа продаж. Администратор задаёт их заранее.
-- Строка в tariff_algorithm_weight_grants разрешает территории менять веса этого алгоритма.

CREATE TABLE IF NOT EXISTS tariff_algorithms (
    code VARCHAR(20) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL,
    sales_share_weight SMALLINT NOT NULL DEFAULT 0,
    price_share_weight SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT tariff_algorithms_sales_weight_check CHECK (sales_share_weight BETWEEN 0 AND 100),
    CONSTRAINT tariff_algorithms_price_weight_check CHECK (price_share_weight BETWEEN 0 AND 100)
);

INSERT INTO tariff_algorithms (code, title, sort_order)
VALUES
    ('category', 'Расчёт по категориям', 1),
    ('product_kind', 'Расчёт по изделиям', 2)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS tariff_algorithm_weight_grants (
    algorithm_code VARCHAR(20) NOT NULL REFERENCES tariff_algorithms (code) ON DELETE CASCADE,
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    PRIMARY KEY (algorithm_code, territory_uuid)
);

COMMENT ON TABLE tariff_algorithms IS
    'Веса алгоритмов тарифа продаж: доля в продажах и доля по средней цене, каждая от 0 до 100.';

COMMENT ON TABLE tariff_algorithm_weight_grants IS
    'Территории, которым разрешено менять веса алгоритма. Пустой список — вес меняет только администратор.';
