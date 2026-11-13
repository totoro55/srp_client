-- Премия за кассовые операции, версия 1. Запрос только читает.
-- $1 — первое число месяца.
-- $2 — сотрудник, пусто значит месяц целиком.
-- $3 — филиал, $4 и $5 — отрезок дат. Для записи месяца они пустые.
-- $6 — начисление с сохранённым kassa_coef. Пусто — текущий коэффициент филиала.
-- $7 — список филиалов. Пусто — без ограничения списком.
-- Запись дней этим файлом не выполняется: пересчёт суммирует результат по дате документа.
--
-- Уже входит в формулу:
--   корзина с показателем «Кассовые операции», версия со скриптом kassa.minutes;
--   ставка kassa_oper читается из таблицы этой версии;
--   минуты × тариф kassa_oper × kassa_coef филиала, коэффициента нет — единица;
--   нет тарифа или минут — строка не входит;
--   филиал — филиал автора из main.author_days на дату документа;
--   автокасса и терминал берут филиал документа, штатная строка важнее промоутера;
--   нет строки штатного расписания на дату — строка не входит.

WITH kassa_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Кассовые операции'
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
        WHERE connection.basket_id = (SELECT id FROM kassa_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.script_id = 'kassa.minutes'
),
rates AS (
    SELECT tariff.territory_uuid,
           tariff.rate
    FROM (
        SELECT connected.territory_uuid,
               basket_data.connection_number(connected.data_table, 'kassa_oper', connected.territory_uuid, $1::date) AS rate
        FROM connected
    ) tariff
    WHERE tariff.rate IS NOT NULL
),
operation_hits AS (
    SELECT operation.*
    FROM raw.kassa_oper operation
    WHERE $2::uuid IS NOT NULL
      AND operation.period = $1::timestamp
      AND operation.author = $2::uuid
    UNION ALL
    SELECT operation.*
    FROM raw.kassa_oper operation
    WHERE $2::uuid IS NULL
      AND operation.period = $1::timestamp
      AND operation.author IS NOT NULL
      AND (
          $4::date IS NULL
          OR COALESCE(operation.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
)
SELECT $1::date AS period,
       branch.territory_uuid,
       assignment.branch_uuid,
       assignment.author_kind,
       issuer.employee_uuid,
       operation.date AS document_date,
       operation.minute::numeric AS minute,
       rates.rate AS tariff,
       COALESCE(coef.value, 1)::numeric AS coefficient,
       ROUND(operation.minute::numeric * rates.rate * COALESCE(coef.value, 1), 2) AS premium
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
               WHEN author_day.author_kind = 'system' THEN operation."Фирма"
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
          AND coefficient.basket_id = (SELECT id FROM kassa_basket)
          AND coefficient.territory_uuid = branch.territory_uuid
          AND coefficient.branch_uuid = assignment.branch_uuid
          AND coefficient.coefficient_key = 'kassa_coef'
          AND coefficient.period <= $1::date
        UNION ALL
        SELECT frozen.value,
               $1::date AS period
        FROM main.premium_accrual_coefficients frozen
        WHERE frozen.accrual_id = $6::bigint
          AND frozen.basket_id = (SELECT id FROM kassa_basket)
          AND frozen.coefficient_key = 'kassa_coef'
    ) source
    ORDER BY source.period DESC
    LIMIT 1
) coef ON TRUE
WHERE issuer.employee_uuid IS NOT NULL
  AND operation.minute IS NOT NULL
  AND operation.minute <> 0
  AND assignment.branch_uuid IS NOT NULL
  AND ($3::uuid IS NULL OR assignment.branch_uuid = $3::uuid)
  AND ($7::uuid[] IS NULL OR assignment.branch_uuid = ANY($7::uuid[]))
  AND (
      $4::date IS NULL
      OR COALESCE(operation.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
  );
