-- Кадровое событие закрывает уже посчитанный отрезок.
-- Пустая причина по-прежнему значит, что зарплата начислена.
-- Повторный запуск только добавляет колонку и не трогает строки.

ALTER TABLE main.premium_accruals
    ADD COLUMN IF NOT EXISTS lock_reason TEXT NOT NULL DEFAULT '';

ALTER TABLE main.premium_accruals
    DROP CONSTRAINT IF EXISTS premium_accruals_lock_reason;

ALTER TABLE main.premium_accruals
    ADD CONSTRAINT premium_accruals_lock_reason
    CHECK (lock_reason IN ('', 'transfer', 'title', 'dismissal'));

COMMENT ON TABLE main.premium_accruals IS
    'Закрытый отрезок сотрудника. Пустая причина — зарплата начислена. transfer, title и dismissal — перевод, смена должности и увольнение. Пересчёт не меняет дни и долю внутри отрезка.';

COMMENT ON COLUMN main.premium_accruals.lock_reason IS
    'Пусто — зарплата начислена. transfer — перевод, title — смена должности, dismissal — увольнение.';
