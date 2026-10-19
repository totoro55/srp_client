-- Месяц выгрузки обязателен. Цифры строки — три полных месяца до этого месяца, декабрь в окно не входит.
-- Уже загруженный снимок без месяца — выгрузка октября 2026.

UPDATE basket_category_stats
SET period = DATE '2026-10-01'
WHERE period IS NULL;

UPDATE basket_kind_stats
SET period = DATE '2026-10-01'
WHERE period IS NULL;

ALTER TABLE basket_category_stats
    ALTER COLUMN period SET NOT NULL;

ALTER TABLE basket_kind_stats
    ALTER COLUMN period SET NOT NULL;

ALTER TABLE basket_category_stats
    DROP CONSTRAINT basket_category_stats_pkey;

ALTER TABLE basket_category_stats
    ADD PRIMARY KEY (territory_uuid, period, category_uuid);

ALTER TABLE basket_kind_stats
    DROP CONSTRAINT basket_kind_stats_pkey;

ALTER TABLE basket_kind_stats
    ADD PRIMARY KEY (territory_uuid, period, kind_uuid);

COMMENT ON COLUMN basket_category_stats.period IS
    'Месяц выгрузки, первое число. Средняя стоимость и количество взяты за три полных месяца до него, декабрь в эти месяцы не входит.';

COMMENT ON COLUMN basket_kind_stats.period IS
    'Месяц выгрузки, первое число. Средняя стоимость и количество взяты за три полных месяца до него, декабрь в эти месяцы не входит.';
