-- Разрешение территории выбирать опору расчёта на экране тарифов.
-- Пустой список: опору выбирает только администратор.

CREATE TABLE IF NOT EXISTS tariff_algorithm_reference_grants (
    algorithm_code VARCHAR(20) NOT NULL REFERENCES tariff_algorithms (code) ON DELETE CASCADE,
    territory_uuid UUID NOT NULL REFERENCES territories (uuid) ON DELETE CASCADE,
    PRIMARY KEY (algorithm_code, territory_uuid)
);

COMMENT ON TABLE tariff_algorithm_reference_grants IS
    'Территории, которым на экране тарифов разрешён выбор опоры расчёта. Пустой список — опору выбирает только администратор.';
