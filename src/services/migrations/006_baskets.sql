-- Каталог корзин мотивации. Назначения на территории появятся отдельной миграцией.
-- Опубликованная версия неизменна: правки идут новым черновиком.

CREATE TABLE IF NOT EXISTS baskets (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    indicator_code VARCHAR(50) NOT NULL,
    settings_schema VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT baskets_code_unique UNIQUE (code),
    CONSTRAINT baskets_status_check CHECK (status IN ('active', 'retired'))
);

CREATE TABLE IF NOT EXISTS basket_versions (
    id SERIAL PRIMARY KEY,
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    instruction TEXT NOT NULL DEFAULT '',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT basket_versions_basket_version_unique UNIQUE (basket_id, version_no),
    CONSTRAINT basket_versions_status_check CHECK (status IN ('draft', 'published')),
    CONSTRAINT basket_versions_version_no_check CHECK (version_no > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS basket_versions_one_draft_uidx
    ON basket_versions (basket_id)
    WHERE status = 'draft';

CREATE INDEX IF NOT EXISTS basket_versions_basket_id_idx
    ON basket_versions (basket_id, version_no DESC);
