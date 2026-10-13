-- Список территорий для тестового подключения хранится на версии, а не на корзине.

DROP TABLE IF EXISTS basket_test_territories;

CREATE TABLE IF NOT EXISTS basket_version_test_territories (
    version_id INTEGER NOT NULL REFERENCES basket_versions (id) ON DELETE CASCADE,
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    PRIMARY KEY (version_id, territory_uuid)
);

COMMENT ON TABLE basket_version_test_territories IS
    'Территории, на которых эту версию можно подключить, пока она тестовая.';
