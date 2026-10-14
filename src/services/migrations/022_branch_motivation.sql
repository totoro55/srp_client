-- Участие филиала в мотивации с указанного месяца.
-- Список филиалов страницы берётся из справочника branches.
-- Филиал без строки в мотивации не участвует: его включают отдельной записью.
-- Срез: ближайший period <= месяца расчёта. Прошлые месяцы не удаляются.

CREATE TABLE IF NOT EXISTS basket_branch_motivation (
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    period DATE NOT NULL,
    branch_uuid UUID NOT NULL REFERENCES branches (uuid) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL,
    set_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    set_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (territory_uuid, period, branch_uuid),
    CONSTRAINT basket_branch_motivation_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_branch_motivation_slice_idx
    ON basket_branch_motivation (territory_uuid, period DESC);

COMMENT ON TABLE basket_branch_motivation IS
    'Участие филиала в мотивации с указанного месяца.';

CREATE TABLE IF NOT EXISTS basket_branch_motivation_log (
    id BIGSERIAL PRIMARY KEY,
    territory_uuid UUID NOT NULL,
    period DATE NOT NULL,
    branch_uuid UUID NOT NULL,
    enabled BOOLEAN NOT NULL,
    set_at TIMESTAMPTZ NOT NULL,
    set_by VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by VARCHAR(255) NOT NULL,
    CONSTRAINT basket_branch_motivation_log_period_month CHECK (period = date_trunc('month', period)::date)
);

CREATE INDEX IF NOT EXISTS basket_branch_motivation_log_idx
    ON basket_branch_motivation_log (territory_uuid, period, recorded_at DESC);
