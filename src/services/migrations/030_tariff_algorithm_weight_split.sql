-- Один слайдер делит 100% между количеством в продажах и средней стоимостью.

UPDATE tariff_algorithms
SET sales_share_weight = 50,
    price_share_weight = 50
WHERE sales_share_weight + price_share_weight <> 100;

ALTER TABLE tariff_algorithms DROP CONSTRAINT IF EXISTS tariff_algorithms_weight_sum_check;
ALTER TABLE tariff_algorithms
    ADD CONSTRAINT tariff_algorithms_weight_sum_check
    CHECK (sales_share_weight + price_share_weight = 100);
