CREATE TABLE IF NOT EXISTS indicators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS indicators_name_lower_uidx ON indicators (lower(name));

INSERT INTO indicators (name)
SELECT candidate.name
FROM (VALUES ('Продажа'), ('Выдача товара')) AS candidate (name)
WHERE NOT EXISTS (
    SELECT 1 FROM indicators existing WHERE lower(existing.name) = lower(candidate.name)
);

ALTER TABLE baskets ADD COLUMN IF NOT EXISTS indicator_id INTEGER;

UPDATE baskets
SET indicator_id = indicators.id
FROM indicators
WHERE baskets.indicator_id IS NULL
  AND baskets.indicator_code = 'sales'
  AND indicators.name = 'Продажа';

UPDATE baskets
SET indicator_id = indicators.id
FROM indicators
WHERE baskets.indicator_id IS NULL
  AND baskets.indicator_code = 'goods_issue'
  AND indicators.name = 'Выдача товара';

INSERT INTO indicators (name)
SELECT DISTINCT baskets.indicator_code
FROM baskets
WHERE baskets.indicator_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM indicators WHERE lower(indicators.name) = lower(baskets.indicator_code)
  );

UPDATE baskets
SET indicator_id = indicators.id
FROM indicators
WHERE baskets.indicator_id IS NULL
  AND lower(indicators.name) = lower(baskets.indicator_code);

ALTER TABLE baskets ALTER COLUMN indicator_id SET NOT NULL;

ALTER TABLE baskets DROP CONSTRAINT IF EXISTS baskets_indicator_id_fkey;
ALTER TABLE baskets
    ADD CONSTRAINT baskets_indicator_id_fkey
    FOREIGN KEY (indicator_id) REFERENCES indicators (id);

ALTER TABLE baskets DROP COLUMN IF EXISTS indicator_code;

CREATE INDEX IF NOT EXISTS baskets_indicator_id_idx ON baskets (indicator_id);
