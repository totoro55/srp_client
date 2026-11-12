-- Вклад промоутера и системной учётки считается в общей премии, не при записи корзины.
DROP TABLE IF EXISTS main.branch_pool_premiums;

-- Общее расписание авторов месяца: сотрудник, промоутер или системная учётка.
-- Корзины и общая премия читают эту таблицу, а не ищут филиал по каждой продаже.
-- Повторный запуск не создаёт таблицу заново.

CREATE TABLE IF NOT EXISTS main.author_days (
    period DATE NOT NULL,
    employee_uuid TEXT NOT NULL,
    day DATE NOT NULL,
    branch_uuid UUID,
    author_kind TEXT NOT NULL,
    PRIMARY KEY (period, employee_uuid, day),
    CONSTRAINT author_days_period_month CHECK (period = date_trunc('month', period)::date),
    CONSTRAINT author_days_kind CHECK (author_kind IN ('staff', 'promoter', 'system')),
    CONSTRAINT author_days_branch CHECK (author_kind = 'system' OR branch_uuid IS NOT NULL)
);

COMMENT ON TABLE main.author_days IS
    'Автор на день месяца. system — автокасса или терминал, филиал берётся из документа. staff важнее promoter.';

COMMENT ON COLUMN main.author_days.author_kind IS
    'staff — штатка, promoter — промоутер без штатной строки на этот день, system — автокасса или терминал самообслуживания.';

COMMENT ON COLUMN main.author_days.branch_uuid IS
    'Филиал сотрудника или промоутера. У системной учётки пусто: филиал строки — филиал документа.';
