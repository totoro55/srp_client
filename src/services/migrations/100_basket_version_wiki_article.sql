-- Статья базы знаний, которую открывает кнопка «Описание» в тарифах.
-- Пустое значение прячет кнопку. Удаление статьи снимает связь.

ALTER TABLE basket_versions
    ADD COLUMN IF NOT EXISTS wiki_article_id INTEGER REFERENCES wiki_articles (id) ON DELETE SET NULL;

COMMENT ON COLUMN basket_versions.wiki_article_id IS 'Статья базы знаний для кнопки «Описание» в тарифах. Пусто — кнопки нет';
