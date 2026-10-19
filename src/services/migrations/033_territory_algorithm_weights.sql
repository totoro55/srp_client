-- Веса алгоритма, которые территория сохранила для своих расчётов.
-- Общие веса в tariff_algorithms не меняются.

CREATE TABLE IF NOT EXISTS tariff_algorithm_territory_weights (
    algorithm_code VARCHAR(20) NOT NULL REFERENCES tariff_algorithms (code) ON DELETE CASCADE,
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    sales_share_weight SMALLINT NOT NULL,
    price_share_weight SMALLINT NOT NULL,
    PRIMARY KEY (algorithm_code, territory_uuid),
    CONSTRAINT tariff_algorithm_territory_weights_sales_check CHECK (sales_share_weight BETWEEN 0 AND 100),
    CONSTRAINT tariff_algorithm_territory_weights_price_check CHECK (price_share_weight BETWEEN 0 AND 100),
    CONSTRAINT tariff_algorithm_territory_weights_sum_check CHECK (sales_share_weight + price_share_weight = 100)
);

COMMENT ON TABLE tariff_algorithm_territory_weights IS
    'Веса алгоритма, сохранённые территорией. Следующий пересчёт читает их вместо общих весов.';
