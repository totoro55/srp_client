ALTER TABLE baskets ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY name, code, id) AS position
    FROM baskets
)
UPDATE baskets AS basket
SET sort_order = ranked.position
FROM ranked
WHERE basket.id = ranked.id
  AND basket.sort_order IS NULL;

ALTER TABLE baskets ALTER COLUMN sort_order SET NOT NULL;
