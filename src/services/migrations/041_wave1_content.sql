-- Новости, база знаний, дорожная карта и обращения.
-- Чтение новости и статьи режет роль. Описание версии корзины дополнительно
-- видно управляющему и сотруднику, только если эта версия подключена.

CREATE TABLE IF NOT EXISTS news_posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news_post_roles (
    post_id INTEGER NOT NULL REFERENCES news_posts (id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, role_id)
);

COMMENT ON TABLE news_posts IS
    'Новость. Видна роли из news_post_roles.';

CREATE TABLE IF NOT EXISTS wiki_groups (
    id SERIAL PRIMARY KEY,
    parent_id INTEGER REFERENCES wiki_groups (id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wiki_group_roles (
    group_id INTEGER NOT NULL REFERENCES wiki_groups (id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, role_id)
);

COMMENT ON TABLE wiki_groups IS
    'Группа статей базы знаний. Роли группы — доступ по умолчанию для вложенных статей.';

CREATE TABLE IF NOT EXISTS wiki_articles (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES wiki_groups (id) ON DELETE RESTRICT,
    title VARCHAR(300) NOT NULL,
    document JSONB NOT NULL,
    plain_text TEXT NOT NULL DEFAULT '',
    inherit_roles BOOLEAN NOT NULL DEFAULT TRUE,
    basket_version_id INTEGER UNIQUE REFERENCES basket_versions (id) ON DELETE SET NULL,
    hint TEXT NOT NULL DEFAULT '',
    sources TEXT NOT NULL DEFAULT '',
    formula TEXT NOT NULL DEFAULT '',
    rules TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(255) NOT NULL,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('russian', plain_text)) STORED
);

CREATE INDEX IF NOT EXISTS wiki_articles_search_idx ON wiki_articles USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS wiki_articles_group_idx ON wiki_articles (group_id);

COMMENT ON TABLE wiki_articles IS
    'Статья базы знаний. Одна статья может описывать одну версию корзины.';

CREATE TABLE IF NOT EXISTS wiki_article_roles (
    article_id INTEGER NOT NULL REFERENCES wiki_articles (id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, role_id)
);

CREATE TABLE IF NOT EXISTS wiki_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id INTEGER REFERENCES wiki_articles (id) ON DELETE CASCADE,
    mime VARCHAR(100) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    content BYTEA NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE wiki_assets IS
    'Снимок экрана статьи. Отдаётся только вместе с доступом к статье.';

CREATE TABLE IF NOT EXISTS roadmap_items (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT roadmap_items_status_check CHECK (status IN ('done', 'now', 'later'))
);

COMMENT ON TABLE roadmap_items IS
    'Веха дорожной карты: сделано, в работе или дальше.';

INSERT INTO roadmap_items (title, description, status, sort_order)
SELECT seed.title, seed.description, seed.status, seed.sort_order
FROM (VALUES
    ('Карточки РРС, корзины и тарифы', 'Настройка территории, корзин, тарифов за продажу, участия филиала и коэффициентов.', 'done', 10),
    ('Новости, база знаний и обратная связь', 'Лента для ролей, описания версий корзин, дорожная карта и обращения.', 'now', 20),
    ('Настройки филиала', 'Обзор тарифов, роли сотрудников, бригады и выдача дополнительных филиалов управляющему.', 'later', 30),
    ('Расчёт премии', 'Свод по филиалу, список сотрудников и детализация премии. Ждёт вьюшки расчёта.', 'later', 40)
) AS seed (title, description, status, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM roadmap_items);

CREATE TABLE IF NOT EXISTS feedback_tickets (
    id SERIAL PRIMARY KEY,
    author VARCHAR(255) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT feedback_tickets_status_check CHECK (status IN ('new', 'progress', 'waiting', 'done', 'declined'))
);

CREATE INDEX IF NOT EXISTS feedback_tickets_author_idx ON feedback_tickets (author, updated_at DESC);

CREATE TABLE IF NOT EXISTS feedback_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER NOT NULL REFERENCES feedback_tickets (id) ON DELETE CASCADE,
    author VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE feedback_tickets IS
    'Обращение сотрудника. Чужие обращения видит роль с правом обработки.';

INSERT INTO role_permission_codes (role_id, permission_code)
SELECT id, 'feedback:process'
FROM roles
WHERE code = 'support'
ON CONFLICT DO NOTHING;
