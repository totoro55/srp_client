-- Премия за складские операции, версия 1. Запрос только читает.
-- $1 — первое число месяца.
-- $2 — сотрудник, пусто значит месяц целиком.
-- $3 — филиал, $4 и $5 — отрезок дат. Для записи месяца они пустые.
-- $6 — начисление с сохранённым warehouse_coef. Пусто — текущий коэффициент филиала.
-- $7 — список филиалов. Пусто — без ограничения списком.
--
-- Уже входит в формулу:
--   корзина с показателем «Складские операции», версия со скриптом warehouse.quantity-volume;
--   ставки quantity и volume читаются из таблицы этой версии;
--   quantity × count_tovar + volume × values, обе части × warehouse_coef;
--   type_operation: Приемка или Отгрузка;
--   филиал — филиал автора из main.author_days на дату документа.

WITH warehouse_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Складские операции'
    LIMIT 1
),
connected AS (
    SELECT latest.territory_uuid,
           latest.version_id,
           version.data_table
    FROM (
        SELECT DISTINCT ON (connection.territory_uuid)
               connection.territory_uuid,
               connection.version_id
        FROM basket_connections connection
        WHERE connection.basket_id = (SELECT id FROM warehouse_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.script_id = 'warehouse.quantity-volume'
),
rates AS MATERIALIZED (
    SELECT tariff.territory_uuid,
           tariff.version_id,
           tariff.quantity,
           tariff.volume
    FROM (
        SELECT connected.territory_uuid,
               connected.version_id,
               basket_data.connection_number(connected.data_table, 'quantity', connected.territory_uuid, $1::date) AS quantity,
               basket_data.connection_number(connected.data_table, 'volume', connected.territory_uuid, $1::date) AS volume
        FROM connected
    ) tariff
    WHERE tariff.quantity IS NOT NULL
      AND tariff.volume IS NOT NULL
),
operation_hits AS (
    SELECT operation.*
    FROM raw.wh_operations operation
    WHERE $2::uuid IS NOT NULL
      AND operation.period = $1::timestamp
      AND operation.author = $2::uuid
    UNION ALL
    SELECT operation.*
    FROM raw.wh_operations operation
    WHERE $2::uuid IS NULL
      AND operation.period = $1::timestamp
      AND operation.author IS NOT NULL
      AND (
          $4::date IS NULL
          OR COALESCE(operation.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
),
worked AS (
    SELECT $1::date AS period,
           branch.territory_uuid,
           assignment.branch_uuid,
           assignment.author_kind,
           issuer.employee_uuid,
           rates.version_id,
           CASE
               WHEN operation.type_operation = 'Приемка' THEN 'прием товара'
               WHEN operation.type_operation = 'Отгрузка' THEN 'отгрузка товара'
               ELSE COALESCE(NULLIF(btrim(operation.type_operation), ''), 'операция')
           END AS operation_title,
           rates.quantity,
           rates.volume AS volume_rate,
           COALESCE(operation.count_tovar, 0)::numeric AS item_count,
           COALESCE(operation."values", 0)::numeric AS volume,
           operation.date AS document_date
    FROM operation_hits operation
    CROSS JOIN LATERAL (
        SELECT operation.author AS employee_uuid
    ) issuer
    JOIN main.author_days author_day
        ON author_day.period = $1::date
       AND author_day.employee_uuid = issuer.employee_uuid
       AND author_day.day = COALESCE(operation.date::date, $1::date)
    CROSS JOIN LATERAL (
        SELECT CASE
                   WHEN author_day.author_kind = 'system' THEN operation.firm_uuid
                   ELSE author_day.branch_uuid
               END AS branch_uuid,
               author_day.author_kind
    ) assignment
    JOIN dictionaries.branches branch ON branch.uuid = assignment.branch_uuid
    JOIN rates ON rates.territory_uuid = branch.territory_uuid
    WHERE issuer.employee_uuid IS NOT NULL
      AND operation.type_operation IN ('Приемка', 'Отгрузка')
      AND (
          COALESCE(operation.count_tovar, 0) <> 0
          OR COALESCE(operation."values", 0) <> 0
      )
      AND assignment.branch_uuid IS NOT NULL
      AND ($3::uuid IS NULL OR assignment.branch_uuid = $3::uuid)
      AND ($7::uuid[] IS NULL OR assignment.branch_uuid = ANY($7::uuid[]))
      AND (
          $4::date IS NULL
          OR COALESCE(operation.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
),
coefficients AS (
    SELECT branch.territory_uuid,
           branch.branch_uuid,
           COALESCE(MAX(coefficient.value), 1) AS warehouse_coef
    FROM (
        SELECT DISTINCT territory_uuid, branch_uuid
        FROM worked
    ) branch
    LEFT JOIN LATERAL (
        SELECT source.value
        FROM (
            SELECT coefficient.value,
                   coefficient.period
            FROM basket_branch_coefficients coefficient
            WHERE $6::bigint IS NULL
              AND coefficient.basket_id = (SELECT id FROM warehouse_basket)
              AND coefficient.territory_uuid = branch.territory_uuid
              AND coefficient.branch_uuid = branch.branch_uuid
              AND coefficient.coefficient_key = 'warehouse_coef'
              AND coefficient.period <= $1::date
            UNION ALL
            SELECT frozen.value,
                   $1::date AS period
            FROM main.premium_accrual_coefficients frozen
            WHERE frozen.accrual_id = $6::bigint
              AND frozen.basket_id = (SELECT id FROM warehouse_basket)
              AND frozen.coefficient_key = 'warehouse_coef'
        ) source
        ORDER BY source.period DESC
        LIMIT 1
    ) coefficient ON TRUE
    GROUP BY branch.territory_uuid, branch.branch_uuid
)
SELECT worked.period,
       worked.territory_uuid,
       worked.branch_uuid,
       worked.author_kind,
       worked.employee_uuid,
       worked.version_id,
       worked.operation_title,
       (worked.quantity * coefficients.warehouse_coef)::numeric AS quantity_tariff,
       (worked.volume_rate * coefficients.warehouse_coef)::numeric AS volume_tariff,
       worked.item_count,
       worked.volume,
       ROUND(
           (worked.quantity * worked.item_count + worked.volume_rate * worked.volume)
           * coefficients.warehouse_coef,
           2
       ) AS premium,
       worked.document_date
FROM worked
JOIN coefficients
    ON coefficients.territory_uuid = worked.territory_uuid
   AND coefficients.branch_uuid = worked.branch_uuid;
