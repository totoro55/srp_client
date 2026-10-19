-- Снимок тарифа хранит, розница от цены или от количества.

ALTER TABLE basket_category_tariffs
    ADD COLUMN IF NOT EXISTS base_mode VARCHAR(20) NOT NULL DEFAULT 'per_unit';

ALTER TABLE basket_category_tariffs
    DROP CONSTRAINT IF EXISTS basket_category_tariffs_mode_check;

ALTER TABLE basket_category_tariffs
    ADD CONSTRAINT basket_category_tariffs_mode_check CHECK (base_mode IN ('percent', 'per_unit'));

ALTER TABLE basket_kind_tariffs
    ADD COLUMN IF NOT EXISTS base_mode VARCHAR(20) NOT NULL DEFAULT 'per_unit';

ALTER TABLE basket_kind_tariffs
    DROP CONSTRAINT IF EXISTS basket_kind_tariffs_mode_check;

ALTER TABLE basket_kind_tariffs
    ADD CONSTRAINT basket_kind_tariffs_mode_check CHECK (base_mode IN ('percent', 'per_unit'));

UPDATE basket_category_tariffs AS tariff
SET base_mode = exception.base_mode
FROM basket_tariff_exceptions AS exception
WHERE exception.territory_uuid = tariff.territory_uuid
  AND exception.period = tariff.period
  AND exception.axis = 'category'
  AND exception.code = tariff.code
  AND exception.removed = FALSE;

UPDATE basket_kind_tariffs AS tariff
SET base_mode = exception.base_mode
FROM basket_tariff_exceptions AS exception
WHERE exception.territory_uuid = tariff.territory_uuid
  AND exception.period = tariff.period
  AND exception.axis = 'product_kind'
  AND exception.code = tariff.code
  AND exception.removed = FALSE;

COMMENT ON COLUMN basket_category_tariffs.base_mode IS
    'Розница: percent — от цены, per_unit — от количества. ИМ и безнал всегда от количества.';

COMMENT ON COLUMN basket_kind_tariffs.base_mode IS
    'Розница: percent — от цены, per_unit — от количества. ИМ и безнал всегда от количества.';
