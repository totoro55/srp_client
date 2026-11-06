-- Бренды СТМ. Один список на компанию.
-- Розница бренда из списка берёт stm_coef, остальная розница — not_stm_coef.
-- Безнал и интернет-магазин этот список не используют.
-- Повторный запуск не пересоздаёт таблицу.

CREATE TABLE IF NOT EXISTS stm_brands (
    name TEXT PRIMARY KEY,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    set_by VARCHAR(255) NOT NULL,
    CONSTRAINT stm_brands_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS stm_brands_name_lower_uidx
    ON stm_brands (lower(btrim(name)));

COMMENT ON TABLE stm_brands IS
    'Бренды СТМ. Один список на компанию. Розница такого бренда берёт коэффициент СТМ.';

COMMENT ON COLUMN stm_brands.name IS
    'Название бренда, как в продаже. Сравнение без учёта регистра и крайних пробелов.';

COMMENT ON COLUMN stm_brands.set_at IS
    'Когда бренд добавили.';

COMMENT ON COLUMN stm_brands.set_by IS
    'Кто добавил бренд.';

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'stm-brands:read'
FROM role_permission_codes
WHERE permission_code = 'price-growth:read'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'stm-brands:write'
FROM role_permission_codes
WHERE permission_code = 'price-growth:write'
ON CONFLICT DO NOTHING;
