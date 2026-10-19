-- Галочка автоматического расчёта. По умолчанию включена.
-- false хранится только когда директор её снял.

ALTER TABLE basket_tariff_exceptions
    ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE basket_tariff_exceptions_log
    ADD COLUMN IF NOT EXISTS automatic BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN basket_tariff_exceptions.automatic IS
    'Автоматический расчёт включён. Снятая галочка сохраняется как false.';
