-- Подключение версии к территории живёт в своей таблице схемы basket_data.
-- Таблица появляется при первой публикации версии как тестовой или рабочей.
-- Уже созданные корзины этой таблицы не имеют, поэтому каталог очищается.

DROP SCHEMA IF EXISTS basket_data CASCADE;
CREATE SCHEMA basket_data;

TRUNCATE TABLE baskets RESTART IDENTITY CASCADE;

ALTER TABLE basket_versions
    ADD COLUMN IF NOT EXISTS data_table VARCHAR(63);

ALTER TABLE basket_versions DROP CONSTRAINT IF EXISTS basket_versions_data_table_check;
ALTER TABLE basket_versions
    ADD CONSTRAINT basket_versions_data_table_check
    CHECK (data_table IS NULL OR data_table ~ '^[a-z][a-z0-9_]{1,49}_v[1-9][0-9]*$');

CREATE UNIQUE INDEX IF NOT EXISTS basket_versions_data_table_uidx
    ON basket_versions (data_table)
    WHERE data_table IS NOT NULL;

COMMENT ON COLUMN basket_versions.data_table IS
    'Имя таблицы в схеме basket_data: код корзины и номер версии, например sales_v2. Пусто, пока версия не опубликована как тестовая или рабочая.';
