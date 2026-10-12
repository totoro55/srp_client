-- День месяца, до которого включительно можно править предыдущий месяц карточки РРС.
-- Верхняя граница 28, чтобы день существовал в каждом месяце.

ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS rrs_edit_cutoff_day INTEGER NOT NULL DEFAULT 5
        CHECK (rrs_edit_cutoff_day BETWEEN 1 AND 28);

COMMENT ON COLUMN app_settings.rrs_edit_cutoff_day IS
    'До этого числа включительно в мастере РРС можно выбрать предыдущий месяц.';
