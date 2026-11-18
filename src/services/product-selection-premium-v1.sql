-- Премия за набор товара, версия 1. Запрос только читает.
-- $1 — первое число месяца.
-- $2 — сотрудник, пусто значит месяц целиком.
-- $3 — филиал, $4 и $5 — отрезок дат. Для записи месяца они пустые.
-- $6 — начисление с сохранённым selection_coef. Пусто — текущий коэффициент филиала.
-- $7 — список филиалов. Пусто — без ограничения списком.
--
-- Уже входит в формулу:
--   корзина с показателем «Набор товара», версия со скриптом selection.quantity-volume;
--   ставки quantity и volume читаются из таблицы этой версии;
--   quantity × count_tovar и volume × volume, обе части × selection_coef;
--   филиал — филиал автора из main.author_days на дату документа.

WITH selection_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Набор товара'
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
        WHERE connection.basket_id = (SELECT id FROM selection_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.script_id = 'selection.quantity-volume'
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
selection_hits AS (
    SELECT picked.*
    FROM raw.product_selection picked
    WHERE $2::uuid IS NOT NULL
      AND picked.period = $1::date
      AND picked.author = $2::uuid
    UNION ALL
    SELECT picked.*
    FROM raw.product_selection picked
    WHERE $2::uuid IS NULL
      AND picked.period = $1::date
      AND picked.author IS NOT NULL
      AND (
          $4::date IS NULL
          OR picked.date BETWEEN $4::date AND COALESCE($5::date, $4::date)
          OR (picked.date IS NULL AND $1::date BETWEEN $4::date AND COALESCE($5::date, $4::date))
      )
),
worked AS (
    SELECT $1::date AS period,
           branch.territory_uuid,
           assignment.branch_uuid,
           assignment.author_kind,
           issuer.employee_uuid,
           rates.version_id,
           COALESCE(NULLIF(btrim(picked.type_nabor), ''), 'набор') AS set_title,
           rates.quantity,
           rates.volume AS volume_rate,
           COALESCE(picked.count_tovar, 0)::numeric AS item_count,
           COALESCE(picked.volume, 0)::numeric AS volume,
           picked.date AS document_date
    FROM selection_hits picked
    CROSS JOIN LATERAL (
        SELECT picked.author AS employee_uuid
    ) issuer
    JOIN main.author_days author_day
        ON author_day.period = $1::date
       AND author_day.employee_uuid = issuer.employee_uuid
       AND author_day.day = COALESCE(picked.date, $1::date)
    CROSS JOIN LATERAL (
        SELECT CASE
                   WHEN author_day.author_kind = 'system' THEN picked.branch_uuid
                   ELSE author_day.branch_uuid
               END AS branch_uuid,
               author_day.author_kind
    ) assignment
    JOIN dictionaries.branches branch ON branch.uuid = assignment.branch_uuid
    JOIN rates ON rates.territory_uuid = branch.territory_uuid
    WHERE issuer.employee_uuid IS NOT NULL
      AND (
          COALESCE(picked.count_tovar, 0) <> 0
          OR COALESCE(picked.volume, 0) <> 0
      )
      AND assignment.branch_uuid IS NOT NULL
      AND ($3::uuid IS NULL OR assignment.branch_uuid = $3::uuid)
      AND ($7::uuid[] IS NULL OR assignment.branch_uuid = ANY($7::uuid[]))
      AND (
          $4::date IS NULL
          OR picked.date BETWEEN $4::date AND COALESCE($5::date, $4::date)
          OR (picked.date IS NULL AND $1::date BETWEEN $4::date AND COALESCE($5::date, $4::date))
      )
),
-- Материализуем: при отрезке дат оценка набора — одна строка, и без этого
-- коэффициент филиала ищется заново на каждую строку набора.
coefficients AS MATERIALIZED (
    SELECT branch.territory_uuid,
           branch.branch_uuid,
           COALESCE(MAX(coefficient.value), 1) AS selection_coef
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
              AND coefficient.basket_id = (SELECT id FROM selection_basket)
              AND coefficient.territory_uuid = branch.territory_uuid
              AND coefficient.branch_uuid = branch.branch_uuid
              AND coefficient.coefficient_key = 'selection_coef'
              AND coefficient.period <= $1::date
            UNION ALL
            SELECT frozen.value,
                   $1::date AS period
            FROM main.premium_accrual_coefficients frozen
            WHERE frozen.accrual_id = $6::bigint
              AND frozen.basket_id = (SELECT id FROM selection_basket)
              AND frozen.coefficient_key = 'selection_coef'
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
       worked.set_title,
       (worked.quantity * coefficients.selection_coef)::numeric AS quantity_tariff,
       (worked.volume_rate * coefficients.selection_coef)::numeric AS volume_tariff,
       worked.item_count,
       worked.volume,
       ROUND(
           (worked.quantity * worked.item_count + worked.volume_rate * worked.volume)
           * coefficients.selection_coef,
           2
       ) AS premium,
       worked.document_date
FROM worked
JOIN coefficients
    ON coefficients.territory_uuid = worked.territory_uuid
   AND coefficients.branch_uuid = worked.branch_uuid;
