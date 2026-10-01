-- Доступность задаётся у версии, а не у корзины.
-- test и working можно подключать, off — нет. Прежняя публикация становится рабочей.

ALTER TABLE basket_versions DROP CONSTRAINT IF EXISTS basket_versions_status_check;

UPDATE basket_versions
SET status = 'working'
WHERE status = 'published';

ALTER TABLE basket_versions
    ADD CONSTRAINT basket_versions_status_check
    CHECK (status IN ('draft', 'test', 'working', 'off'));
