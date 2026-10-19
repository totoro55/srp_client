-- Алгоритмы названы по оси расчёта: категория товара и вид изделия.

INSERT INTO tariff_algorithms (code, title, sort_order, sales_share_weight, price_share_weight)
SELECT 'category', 'Расчёт по категориям', 1, sales_share_weight, price_share_weight
FROM tariff_algorithms
WHERE code = 'percent'
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    sort_order = EXCLUDED.sort_order,
    sales_share_weight = EXCLUDED.sales_share_weight,
    price_share_weight = EXCLUDED.price_share_weight;

INSERT INTO tariff_algorithms (code, title, sort_order, sales_share_weight, price_share_weight)
SELECT 'product_kind', 'Расчёт по изделиям', 2, sales_share_weight, price_share_weight
FROM tariff_algorithms
WHERE code = 'per_unit'
ON CONFLICT (code) DO UPDATE
SET title = EXCLUDED.title,
    sort_order = EXCLUDED.sort_order,
    sales_share_weight = EXCLUDED.sales_share_weight,
    price_share_weight = EXCLUDED.price_share_weight;

INSERT INTO tariff_algorithm_weight_grants (algorithm_code, territory_uuid)
SELECT 'category', territory_uuid
FROM tariff_algorithm_weight_grants
WHERE algorithm_code = 'percent'
ON CONFLICT DO NOTHING;

INSERT INTO tariff_algorithm_weight_grants (algorithm_code, territory_uuid)
SELECT 'product_kind', territory_uuid
FROM tariff_algorithm_weight_grants
WHERE algorithm_code = 'per_unit'
ON CONFLICT DO NOTHING;

DELETE FROM tariff_algorithm_weight_grants
WHERE algorithm_code IN ('percent', 'per_unit');

DELETE FROM tariff_algorithms
WHERE code IN ('percent', 'per_unit');

UPDATE tariff_algorithms
SET title = 'Расчёт по категориям', sort_order = 1
WHERE code = 'category';

UPDATE tariff_algorithms
SET title = 'Расчёт по изделиям', sort_order = 2
WHERE code = 'product_kind';
