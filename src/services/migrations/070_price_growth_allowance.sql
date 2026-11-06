-- Надбавка в связи с ростом цен. Одна на всю компанию.
-- Новая строка пишется, когда значение меняется. Прошлые месяцы не переписываются.
-- Для расчёта берётся последняя строка, месяц которой не позже рассчитываемого.
-- Сотрудникам не показывается.

CREATE TABLE IF NOT EXISTS price_growth_allowances (
    period DATE PRIMARY KEY,
    value NUMERIC(14, 2) NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    set_by VARCHAR(255) NOT NULL,
    CONSTRAINT price_growth_allowances_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT price_growth_allowances_value_nonnegative CHECK (value >= 0)
);

COMMENT ON TABLE price_growth_allowances IS
    'Надбавка в связи с ростом цен. Одна на компанию с указанного месяца. Сотрудникам не показывается.';

COMMENT ON COLUMN price_growth_allowances.period IS
    'Месяц, с которого действует значение. Первое число.';

COMMENT ON COLUMN price_growth_allowances.value IS
    'Значение надбавки. Одно для всех сотрудников.';

COMMENT ON COLUMN price_growth_allowances.set_at IS
    'Когда записали значение.';

COMMENT ON COLUMN price_growth_allowances.set_by IS
    'Кто записал значение.';

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'price-growth:read'
FROM role_permission_codes
WHERE permission_code = 'motivation-roles:read'
ON CONFLICT DO NOTHING;

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT DISTINCT role_id, 'price-growth:write'
FROM role_permission_codes
WHERE permission_code = 'motivation-roles:write'
ON CONFLICT DO NOTHING;
