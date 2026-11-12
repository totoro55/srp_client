-- Вклад промоутеров и технических учёток в общую премию филиала.
-- Считается вместе с корзиной. В дни корзины эти суммы не пишутся.
-- Повторный запуск не создаёт таблицу заново.

CREATE TABLE IF NOT EXISTS main.branch_pool_premiums (
    period DATE NOT NULL,
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    branch_uuid UUID NOT NULL,
    source TEXT NOT NULL,
    premium NUMERIC(18, 2) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (period, basket_id, branch_uuid, source),
    CONSTRAINT branch_pool_premiums_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT branch_pool_premiums_source CHECK (source IN ('promoter', 'system'))
);

COMMENT ON TABLE main.branch_pool_premiums IS
    'Сумма премии промоутеров и технических учёток по филиалу и корзине. Общая премия читает её и не считает продажи заново.';

COMMENT ON COLUMN main.branch_pool_premiums.source IS
    'promoter — промоутер без штатной строки на дату документа, system — автокасса или терминал самообслуживания.';

COMMENT ON COLUMN main.branch_pool_premiums.premium IS
    'Сумма премии филиала по этой корзине и этому источнику, в рублях с копейками.';
