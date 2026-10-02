-- Корзина может быть обязательной для включения на территории (РРС).
-- Обязательность снимается в карточке корзины.

ALTER TABLE baskets
    ADD COLUMN IF NOT EXISTS mandatory BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN baskets.mandatory IS
    'РРС обязана включить эту корзину при настройке территории.';
