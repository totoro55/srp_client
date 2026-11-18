-- Вклад промоутера и системной учётки хранится в днях корзины.
-- Общая премия читает эти дни и больше не пересчитывает документы.
-- Уже записанные дни — штатка.

ALTER TABLE main.basket_premium_days
    ADD COLUMN IF NOT EXISTS author_kind TEXT NOT NULL DEFAULT 'staff';

ALTER TABLE main.basket_premium_days
    DROP CONSTRAINT IF EXISTS basket_premium_days_kind;

ALTER TABLE main.basket_premium_days
    ADD CONSTRAINT basket_premium_days_kind CHECK (author_kind IN ('staff', 'promoter', 'system'));

COMMENT ON TABLE main.basket_premium_days IS
    'Сумма премии за день документа и вид автора. Филиал штатки и промоутера — день в main.author_days, у системной учётки — филиал документа.';

COMMENT ON COLUMN main.basket_premium_days.author_kind IS
    'staff — штатка, promoter — промоутер, system — автокасса или терминал. Кабинет и бригада читают staff. Общая премия берёт promoter и system отсюда.';

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
  AND day.author_kind = 'staff'
GROUP BY day.period, day.territory_uuid, day.branch_uuid, day.employee_uuid;

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
  AND day.author_kind = 'staff'
GROUP BY day.period, day.territory_uuid, day.branch_uuid;

CREATE OR REPLACE VIEW main.sale_premium_territories AS
SELECT day.period,
       day.territory_uuid,
       SUM(day.premium) AS premium,
       COUNT(DISTINCT day.branch_uuid)::bigint AS branches
FROM main.basket_premium_days day
JOIN baskets basket ON basket.id = day.basket_id
JOIN indicators indicator ON indicator.id = basket.indicator_id
WHERE indicator.name = 'Продажа товара'
  AND day.author_kind = 'staff'
GROUP BY day.period, day.territory_uuid;
