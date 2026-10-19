-- Справочники категорий и видов изделий и статистика продаж по территориям.
-- Папки parent_1..parent_3 — подписи уровней, parent_1 ближайшая.
-- В статистике нет канала продаж: средняя стоимость и количество общие.
-- period пустой, пока в выгрузке нет месяца. Ключ снимка — территория и код.

CREATE TABLE IF NOT EXISTS product_categories (
    uuid UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_1 VARCHAR(255),
    parent_2 VARCHAR(255),
    parent_3 VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product_categories IS
    'Справочник категорий товара. parent_1 — ближайшая папка, parent_3 — верхняя.';

CREATE TABLE IF NOT EXISTS product_kinds (
    uuid UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    parent_1 VARCHAR(255),
    parent_2 VARCHAR(255),
    parent_3 VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE product_kinds IS
    'Справочник видов изделий. parent_1 — ближайшая папка, parent_3 — верхняя.';

CREATE TABLE IF NOT EXISTS basket_category_stats (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    category_uuid UUID NOT NULL REFERENCES product_categories (uuid) ON DELETE RESTRICT,
    period DATE,
    avg_price NUMERIC,
    sum_quantity NUMERIC,
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, category_uuid),
    CONSTRAINT basket_category_stats_period_month CHECK (
        period IS NULL OR period = date_trunc('month', period)::date
    )
);

COMMENT ON TABLE basket_category_stats IS
    'Средняя стоимость и число проданных штук категории на территории. Канала продаж нет.';

COMMENT ON COLUMN basket_category_stats.period IS
    'Месяц выгрузки. Пусто, если в файле месяца не было.';

CREATE INDEX IF NOT EXISTS basket_category_stats_category_idx
    ON basket_category_stats (category_uuid);

CREATE TABLE IF NOT EXISTS basket_kind_stats (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    kind_uuid UUID NOT NULL REFERENCES product_kinds (uuid) ON DELETE RESTRICT,
    period DATE,
    avg_price NUMERIC,
    sum_quantity NUMERIC,
    loaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, kind_uuid),
    CONSTRAINT basket_kind_stats_period_month CHECK (
        period IS NULL OR period = date_trunc('month', period)::date
    )
);

COMMENT ON TABLE basket_kind_stats IS
    'Средняя стоимость и число проданных штук вида изделия на территории. Канала продаж нет.';

COMMENT ON COLUMN basket_kind_stats.period IS
    'Месяц выгрузки. Пусто, если в файле месяца не было.';

CREATE INDEX IF NOT EXISTS basket_kind_stats_kind_idx
    ON basket_kind_stats (kind_uuid);
