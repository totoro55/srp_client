-- Сохранённый снимок тарифов месяца. Пустые main, im и b2b значат, что ставка ещё не рассчитана.

CREATE TABLE IF NOT EXISTS basket_category_tariffs (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    period DATE NOT NULL,
    version_id INTEGER NOT NULL REFERENCES basket_versions (id),
    code UUID NOT NULL REFERENCES dictionaries.product_categories (uuid) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    main NUMERIC,
    im NUMERIC,
    b2b NUMERIC,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, period, code),
    CONSTRAINT basket_category_tariffs_period_month CHECK (period = date_trunc('month', period)::date)
);

COMMENT ON TABLE basket_category_tariffs IS
    'Рассчитанные тарифы категории на территории за месяц выгрузки. Пустая ставка ещё не посчитана.';

CREATE TABLE IF NOT EXISTS basket_kind_tariffs (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    period DATE NOT NULL,
    version_id INTEGER NOT NULL REFERENCES basket_versions (id),
    code UUID NOT NULL REFERENCES dictionaries.product_kinds (uuid) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    main NUMERIC,
    im NUMERIC,
    b2b NUMERIC,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (territory_uuid, period, code),
    CONSTRAINT basket_kind_tariffs_period_month CHECK (period = date_trunc('month', period)::date)
);

COMMENT ON TABLE basket_kind_tariffs IS
    'Рассчитанные тарифы вида изделия на территории за месяц выгрузки. Пустая ставка ещё не посчитана.';
