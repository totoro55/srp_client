-- Премия за выдачу, версия 1. Запрос только читает.
-- $1 — первое число месяца.
-- $2 — сотрудник, пусто значит месяц целиком.
-- $3 — филиал, $4 и $5 — отрезок дат. Для записи месяца они пустые.
-- $6 — начисление с сохранённым release_coef. Пусто — текущий коэффициент филиала.
-- $7 — список филиалов. Пусто — без ограничения списком.
-- Запись дней этим файлом не выполняется: пересчёт суммирует результат по дате документа.
--
-- Уже входит в формулу:
--   корзина с показателем «Выдача товара», подключённая версия 1, таблица release_v1;
--   выдача засчитывается author2, пустой author2 не входит;
--   поиск сотрудника повторяет условие индекса raw.sale_period_author2_idx,
--   иначе планировщик читает весь месяц;
--   филиал — филиал автора из main.author_days на дату документа;
--   автокасса и терминал берут филиал документа, штатная строка важнее промоутера;
--   ставка quantity × количество, ставка volume × объём;
--   обе ставки умножаются на release_coef филиала, коэффициента нет — единица;
--   нет ставки количества или объёма — строка не входит;
--   каналы, СТМ и множитель ×2 не применяются.

WITH issue_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Выдача товара'
    LIMIT 1
),
connected AS (
    SELECT latest.territory_uuid,
           latest.version_id
    FROM (
        SELECT DISTINCT ON (connection.territory_uuid)
               connection.territory_uuid,
               connection.version_id
        FROM basket_connections connection
        WHERE connection.basket_id = (SELECT id FROM issue_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.version_no = 1
      AND version.data_table = 'release_v1'
),
rates AS (
    SELECT connected.territory_uuid,
           connected.version_id,
           tariff.quantity,
           tariff.volume
    FROM connected
    JOIN LATERAL (
        SELECT params.quantity,
               params.volume
        FROM basket_data.release_v1 params
        WHERE params.territory_uuid = connected.territory_uuid
          AND params.period <= $1::date
        ORDER BY params.period DESC
        LIMIT 1
    ) tariff ON tariff.quantity IS NOT NULL
            AND tariff.volume IS NOT NULL
),
issue_hits AS (
    SELECT sale.*
    FROM raw.sale sale
    WHERE $2::uuid IS NOT NULL
      AND sale.period = $1::timestamp
      AND sale.author2 = $2::uuid
    UNION ALL
    SELECT sale.*
    FROM raw.sale sale
    WHERE $2::uuid IS NULL
      AND sale.period = $1::timestamp
      AND sale.author2 IS NOT NULL
      AND (
          $4::date IS NULL
          OR COALESCE(sale.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
)
SELECT $1::date AS period,
       branch.territory_uuid,
       assignment.branch_uuid,
       assignment.author_kind,
       issuer.employee_uuid,
       rates.version_id,
       sale.category AS category_code,
       (rates.quantity * COALESCE(coef.value, 1))::numeric AS quantity_tariff,
       (rates.volume * COALESCE(coef.value, 1))::numeric AS volume_tariff,
       sale.count AS item_count,
       sale.volume,
       ROUND(
           (rates.quantity * sale.count::numeric + rates.volume * sale.volume::numeric)
           * COALESCE(coef.value, 1),
           2
       ) AS premium,
       NULLIF(btrim(sale.link_doc), '') AS link_doc,
       NULLIF(btrim(sale.document_number), '') AS document_number,
       sale.date AS document_date,
       NULLIF(btrim(sale.name_product), '') AS product_name
FROM issue_hits sale
CROSS JOIN LATERAL (
    SELECT sale.author2 AS employee_uuid
) issuer
JOIN main.author_days author_day
    ON author_day.period = $1::date
   AND author_day.employee_uuid = issuer.employee_uuid
   AND author_day.day = COALESCE(sale.date::date, $1::date)
CROSS JOIN LATERAL (
    SELECT CASE
               WHEN author_day.author_kind = 'system' THEN sale.firm_uuid
               ELSE author_day.branch_uuid
           END AS branch_uuid,
           author_day.author_kind
) assignment
JOIN dictionaries.branches branch ON branch.uuid = assignment.branch_uuid
JOIN rates ON rates.territory_uuid = branch.territory_uuid
LEFT JOIN LATERAL (
    SELECT source.value
    FROM (
        SELECT coefficient.value,
               coefficient.period
        FROM basket_branch_coefficients coefficient
        WHERE $6::bigint IS NULL
          AND coefficient.basket_id = (SELECT id FROM issue_basket)
          AND coefficient.territory_uuid = branch.territory_uuid
          AND coefficient.branch_uuid = assignment.branch_uuid
          AND coefficient.coefficient_key = 'release_coef'
          AND coefficient.period <= $1::date
        UNION ALL
        SELECT frozen.value,
               $1::date AS period
        FROM main.premium_accrual_coefficients frozen
        WHERE frozen.accrual_id = $6::bigint
          AND frozen.basket_id = (SELECT id FROM issue_basket)
          AND frozen.coefficient_key = 'release_coef'
    ) source
    ORDER BY source.period DESC
    LIMIT 1
) coef ON TRUE
WHERE issuer.employee_uuid IS NOT NULL
  AND sale.count IS NOT NULL
  AND sale.volume IS NOT NULL
  AND ($3::uuid IS NULL OR assignment.branch_uuid = $3::uuid)
  AND ($7::uuid[] IS NULL OR assignment.branch_uuid = ANY($7::uuid[]))
  AND (
      $4::date IS NULL
      OR COALESCE(sale.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
  );
