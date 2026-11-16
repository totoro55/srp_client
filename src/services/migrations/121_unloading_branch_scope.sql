-- Поиск площадок, где сотрудник филиала разгружал ТС, без просмотра всех приёмок.

CREATE INDEX IF NOT EXISTS unloading_car_period_author_idx
    ON raw.unloading_car ("period", author);

CREATE INDEX IF NOT EXISTS author_days_period_branch_idx
    ON main.author_days (period, branch_uuid)
    WHERE branch_uuid IS NOT NULL;

COMMENT ON INDEX raw.unloading_car_period_author_idx IS
    'Площадки разгрузки одного автора за месяц.';

COMMENT ON INDEX main.author_days_period_branch_idx IS
    'Сотрудники филиала за месяц: объём разгрузки считается только по их площадкам.';
