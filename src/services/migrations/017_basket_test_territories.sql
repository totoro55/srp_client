-- Тестовую версию корзины можно подключить только на явно выбранных территориях.
-- Пустой список означает, что тестовую версию нельзя подключить нигде.

CREATE TABLE IF NOT EXISTS basket_test_territories (
    basket_id INTEGER NOT NULL REFERENCES baskets (id) ON DELETE CASCADE,
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    PRIMARY KEY (basket_id, territory_uuid)
);

COMMENT ON TABLE basket_test_territories IS
    'Территории, на которых разрешено подключать тестовые версии этой корзины.';
