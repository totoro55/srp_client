-- Премия за выставление товара, версия 1. Запрос только читает.
-- $1 — первое число месяца.
-- $2 — сотрудник, пусто значит месяц целиком. Доля зоны считается по всем
-- авторам филиала документа, даже когда запрошен один сотрудник.
-- $3 — филиал премии. Пусто — все филиалы.
-- $4 и $5 — отрезок дат. Для записи месяца они пустые.
-- $6 — начисление с сохранённым display_coef. Пусто — текущий коэффициент филиала.
-- $7 — список филиалов премии. Пусто — без ограничения списком.
--
-- Уже входит в формулу:
--   корзина с показателем «Выставление товара», версия со скриптом display.quantity-volume;
--   ставки quantity и volume читаются из таблицы этой версии;
--   количество и объём строки — итог зоны за день, поэтому зона берётся один раз (MAX);
--   зона делится поровну между штатными сотрудниками зоны с fact_hour > 0;
--   «Без зоны», пустая зона и нулевой автор в долю зоны не входят;
--   их итог и зоны без часов складываются в «Общую» филиала документа за день;
--   «Общая» делится поровну между всеми, кто в этот день привязан к зоне этого филиала и у кого есть часы табеля;
--   часов нет ни у кого — премия не начисляется;
--   сотрудник из штатки без строки выставления долю не получает;
--   филиал премии — филиал сотрудника из main.author_days;
--   (quantity × доля количества + volume × доля объёма) × display_coef.

WITH display_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Выставление товара'
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
        WHERE connection.basket_id = (SELECT id FROM display_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.script_id = 'display.quantity-volume'
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
premium_scope AS (
    SELECT $3::uuid AS branch_uuid
    WHERE $2::uuid IS NULL
      AND $3::uuid IS NOT NULL
    UNION
    SELECT branch_id
    FROM unnest(COALESCE($7::uuid[], ARRAY[]::uuid[])) AS branch_id
    WHERE $2::uuid IS NULL
      AND $3::uuid IS NULL
      AND $7::uuid[] IS NOT NULL
),
employee_documents AS (
    SELECT DISTINCT placed.branch_uuid
    FROM raw.vystavleniye placed
    WHERE $2::uuid IS NOT NULL
      AND placed.period = $1::timestamp
      AND placed.branch_uuid IS NOT NULL
      AND placed.author = $2::uuid
      AND (
          $4::date IS NULL
          OR placed."date"::date BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
),
staffed_documents AS (
    SELECT DISTINCT placed.branch_uuid
    FROM raw.vystavleniye placed
    JOIN main.author_days author_day
      ON author_day.period = $1::date
     AND author_day.employee_uuid = placed.author
     AND author_day.day = placed."date"::date
     AND author_day.branch_uuid IN (SELECT premium_scope.branch_uuid FROM premium_scope)
    WHERE $2::uuid IS NULL
      AND ($3::uuid IS NOT NULL OR $7::uuid[] IS NOT NULL)
      AND placed.period = $1::timestamp
      AND placed.branch_uuid IS NOT NULL
      AND placed."date" IS NOT NULL
      AND placed.author IS NOT NULL
      AND placed.author <> '00000000-0000-0000-0000-000000000000'::uuid
      AND (
          $4::date IS NULL
          OR placed."date"::date BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
),
document_branches AS (
    SELECT employee_documents.branch_uuid FROM employee_documents
    UNION
    SELECT staffed_documents.branch_uuid FROM staffed_documents
    UNION
    SELECT premium_scope.branch_uuid FROM premium_scope
),
placed AS MATERIALIZED (
    SELECT placed.branch_uuid,
           placed."date"::date AS day,
           placed.author,
           regexp_replace(btrim(COALESCE(placed.zone, '')), '^!+', '') AS zone_label,
           lower(regexp_replace(btrim(COALESCE(placed.zone, '')), '^!+', '')) IN ('без зоны', '') AS unzoned,
           placed.author IS NULL
               OR placed.author = '00000000-0000-0000-0000-000000000000'::uuid AS anonymous,
           COALESCE(placed.count, 0)::numeric AS item_count,
           COALESCE(placed.volume, 0)::numeric AS volume
    FROM raw.vystavleniye placed
    WHERE placed.period = $1::timestamp
      AND placed.branch_uuid IS NOT NULL
      AND placed."date" IS NOT NULL
      AND (
          $4::date IS NULL
          OR placed."date"::date BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
      AND (
          ($2::uuid IS NULL AND $3::uuid IS NULL AND $7::uuid[] IS NULL)
          OR placed.branch_uuid IN (SELECT document_branch.branch_uuid FROM document_branches document_branch)
      )
),
zone_totals AS (
    SELECT branch_uuid,
           day,
           CASE WHEN unzoned THEN CHR(1) ELSE zone_label END AS zone_key,
           BOOL_OR(unzoned) AS unzoned,
           MAX(item_count) AS item_count,
           MAX(volume) AS volume
    FROM placed
    GROUP BY branch_uuid, day, CASE WHEN unzoned THEN CHR(1) ELSE zone_label END
),
zone_authors AS MATERIALIZED (
    SELECT DISTINCT branch_uuid,
           day,
           zone_label AS zone_key,
           author
    FROM placed
    WHERE NOT unzoned
      AND NOT anonymous
      AND author IS NOT NULL
),
hours AS MATERIALIZED (
    SELECT sheet.employees_uuid::text AS employee_uuid,
           sheet."date"::date AS day
    FROM raw.grafiki_tabeli sheet
    WHERE sheet.period = $1::timestamp
      AND sheet.fact_hour > 0
      AND sheet."date" IS NOT NULL
      AND sheet.employees_uuid::text IN (SELECT zone_authors.author::text FROM zone_authors)
      AND (
          $4::date IS NULL
          OR sheet."date"::date BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
    GROUP BY sheet.employees_uuid::text, sheet."date"::date
),
eligible AS MATERIALIZED (
    SELECT zone_authors.branch_uuid AS document_branch,
           zone_authors.day,
           zone_authors.zone_key,
           zone_authors.author AS employee_uuid,
           author_day.author_kind,
           author_day.branch_uuid AS premium_branch
    FROM zone_authors
    JOIN hours
      ON hours.employee_uuid = zone_authors.author::text
     AND hours.day = zone_authors.day
    JOIN main.author_days author_day
      ON author_day.period = $1::date
     AND author_day.employee_uuid = zone_authors.author
     AND author_day.day = zone_authors.day
    WHERE author_day.author_kind = 'staff'
      AND author_day.branch_uuid IS NOT NULL
),
zone_headcount AS (
    SELECT document_branch,
           day,
           zone_key,
           COUNT(*)::numeric AS participants
    FROM eligible
    GROUP BY document_branch, day, zone_key
),
zone_shares AS (
    SELECT eligible.document_branch,
           eligible.day,
           eligible.employee_uuid,
           eligible.author_kind,
           eligible.premium_branch,
           zone_totals.zone_key AS zone_title,
           zone_headcount.participants,
           zone_totals.item_count AS zone_item_count,
           zone_totals.volume AS zone_volume,
           zone_totals.item_count / zone_headcount.participants AS item_count,
           zone_totals.volume / zone_headcount.participants AS volume
    FROM eligible
    JOIN zone_headcount
      ON zone_headcount.document_branch = eligible.document_branch
     AND zone_headcount.day = eligible.day
     AND zone_headcount.zone_key = eligible.zone_key
    JOIN zone_totals
      ON zone_totals.branch_uuid = eligible.document_branch
     AND zone_totals.day = eligible.day
     AND zone_totals.zone_key = eligible.zone_key
     AND NOT zone_totals.unzoned
),
pool_amounts AS (
    SELECT source.branch_uuid AS document_branch,
           source.day,
           SUM(source.item_count) AS item_count,
           SUM(source.volume) AS volume
    FROM (
        SELECT zone_totals.branch_uuid,
               zone_totals.day,
               zone_totals.item_count,
               zone_totals.volume
        FROM zone_totals
        WHERE zone_totals.unzoned
        UNION ALL
        SELECT zone_totals.branch_uuid,
               zone_totals.day,
               zone_totals.item_count,
               zone_totals.volume
        FROM zone_totals
        LEFT JOIN zone_headcount
          ON zone_headcount.document_branch = zone_totals.branch_uuid
         AND zone_headcount.day = zone_totals.day
         AND zone_headcount.zone_key = zone_totals.zone_key
        WHERE NOT zone_totals.unzoned
          AND zone_headcount.participants IS NULL
    ) source
    GROUP BY source.branch_uuid, source.day
),
pool_people AS (
    SELECT DISTINCT document_branch,
           day,
           employee_uuid,
           author_kind,
           premium_branch
    FROM eligible
),
pool_headcount AS (
    SELECT document_branch,
           day,
           COUNT(*)::numeric AS participants
    FROM pool_people
    GROUP BY document_branch, day
),
pool_shares AS (
    SELECT pool_people.document_branch,
           pool_people.day,
           pool_people.employee_uuid,
           pool_people.author_kind,
           pool_people.premium_branch,
           'Общая'::text AS zone_title,
           pool_headcount.participants,
           pool_amounts.item_count AS zone_item_count,
           pool_amounts.volume AS zone_volume,
           pool_amounts.item_count / pool_headcount.participants AS item_count,
           pool_amounts.volume / pool_headcount.participants AS volume
    FROM pool_people
    JOIN pool_headcount
      ON pool_headcount.document_branch = pool_people.document_branch
     AND pool_headcount.day = pool_people.day
    JOIN pool_amounts
      ON pool_amounts.document_branch = pool_people.document_branch
     AND pool_amounts.day = pool_people.day
    WHERE pool_headcount.participants > 0
      AND (pool_amounts.item_count <> 0 OR pool_amounts.volume <> 0)
),
shares AS (
    SELECT zone_shares.document_branch,
           zone_shares.day,
           zone_shares.employee_uuid,
           zone_shares.author_kind,
           zone_shares.premium_branch,
           zone_shares.zone_title,
           zone_shares.participants,
           zone_shares.zone_item_count,
           zone_shares.zone_volume,
           zone_shares.item_count,
           zone_shares.volume
    FROM zone_shares
    WHERE zone_shares.item_count <> 0
       OR zone_shares.volume <> 0
    UNION ALL
    SELECT pool_shares.document_branch,
           pool_shares.day,
           pool_shares.employee_uuid,
           pool_shares.author_kind,
           pool_shares.premium_branch,
           pool_shares.zone_title,
           pool_shares.participants,
           pool_shares.zone_item_count,
           pool_shares.zone_volume,
           pool_shares.item_count,
           pool_shares.volume
    FROM pool_shares
),
worked AS MATERIALIZED (
    SELECT $1::date AS period,
           branch.territory_uuid,
           shares.premium_branch AS branch_uuid,
           shares.author_kind,
           shares.employee_uuid,
           rates.version_id,
           COALESCE(NULLIF(shares.zone_title, ''), 'Зона') AS zone_title,
           shares.participants,
           shares.zone_item_count,
           shares.zone_volume,
           rates.quantity,
           rates.volume AS volume_rate,
           shares.item_count,
           shares.volume,
           shares.day AS document_date
    FROM shares
    JOIN dictionaries.branches branch ON branch.uuid = shares.premium_branch
    JOIN rates ON rates.territory_uuid = branch.territory_uuid
    WHERE ($2::uuid IS NULL OR shares.employee_uuid = $2::uuid)
      AND ($3::uuid IS NULL OR shares.premium_branch = $3::uuid)
      AND ($7::uuid[] IS NULL OR shares.premium_branch = ANY($7::uuid[]))
),
-- Материализуем: без этого коэффициент филиала ищется заново на каждую долю зоны.
coefficients AS MATERIALIZED (
    SELECT branch.territory_uuid,
           branch.branch_uuid,
           COALESCE(MAX(coefficient.value), 1) AS display_coef
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
              AND coefficient.basket_id = (SELECT id FROM display_basket)
              AND coefficient.territory_uuid = branch.territory_uuid
              AND coefficient.branch_uuid = branch.branch_uuid
              AND coefficient.coefficient_key = 'display_coef'
              AND coefficient.period <= $1::date
            UNION ALL
            SELECT frozen.value,
                   $1::date AS period
            FROM main.premium_accrual_coefficients frozen
            WHERE frozen.accrual_id = $6::bigint
              AND frozen.basket_id = (SELECT id FROM display_basket)
              AND frozen.coefficient_key = 'display_coef'
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
       worked.zone_title,
       worked.participants,
       worked.zone_item_count,
       worked.zone_volume,
       (worked.quantity * coefficients.display_coef)::numeric AS quantity_tariff,
       (worked.volume_rate * coefficients.display_coef)::numeric AS volume_tariff,
       worked.item_count,
       worked.volume,
       ROUND(
           (worked.quantity * worked.item_count + worked.volume_rate * worked.volume)
           * coefficients.display_coef,
           2
       ) AS premium,
       worked.document_date
FROM worked
JOIN coefficients
    ON coefficients.territory_uuid = worked.territory_uuid
   AND coefficients.branch_uuid = worked.branch_uuid
WHERE (worked.quantity * worked.item_count + worked.volume_rate * worked.volume) <> 0
  AND coefficients.display_coef <> 0;
