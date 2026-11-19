-- Премия за разгрузку ТС, версия 1. Запрос только читает.
-- $1 — первое число месяца.
-- $2 — сотрудник, пусто значит месяц целиком.
-- $3 — филиал премии. Пусто — все филиалы. Для одного филиала объём считается
-- на нём самом и на площадках, где разгружали его сотрудников, а не по всей компании.
-- $4 и $5 — отрезок дат. Для записи месяца они пустые.
-- $6 — начисление с сохранённым unloading_coef. Пусто — текущий коэффициент филиала.
-- $7 — список филиалов. Пусто — без ограничения списком.
--
-- Логика объёма на филиале документа (firm_uuid / branch_uuid графика):
--   рабочий день = есть ТС в grafik_otgruzok или есть строка unloading_car;
--   объём Приемки в нерабочий день уходит на предыдущий рабочий день;
--   до первого рабочего дня месяца и день только с графиком без разгрузки — объём отбрасывается;
--   премия только в дни с выполненной разгрузкой: объём / число участников × volume × unloading_coef;
--   филиал премии сотрудника — из main.author_days (штатное расписание).

WITH unloading_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Разгрузка ТС'
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
        WHERE connection.basket_id = (SELECT id FROM unloading_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.script_id = 'unloading.volume'
),
rates AS MATERIALIZED (
    SELECT tariff.territory_uuid,
           tariff.rate
    FROM (
        SELECT connected.territory_uuid,
               basket_data.connection_number(connected.data_table, 'volume', connected.territory_uuid, $1::date) AS rate
        FROM connected
    ) tariff
    WHERE tariff.rate IS NOT NULL
),
month_days AS (
    SELECT generate_series($1::date, ($1::date + INTERVAL '1 month - 1 day')::date, INTERVAL '1 day')::date AS day
),
employee_branches AS (
    SELECT DISTINCT unloading.firm_uuid AS branch_uuid
    FROM raw.unloading_car unloading
    WHERE $2::uuid IS NOT NULL
      AND unloading.period = $1::timestamp
      AND unloading.author = $2::uuid
      AND unloading.firm_uuid IS NOT NULL
),
premium_branches AS (
    SELECT $3::uuid AS branch_uuid
    WHERE $2::uuid IS NULL
      AND $3::uuid IS NOT NULL
    UNION
    SELECT DISTINCT unloading.firm_uuid
    FROM main.author_days author_day
    JOIN raw.unloading_car unloading
      ON unloading.period = $1::timestamp
     AND unloading.author = author_day.employee_uuid
     AND unloading.date::date = author_day.day
     AND unloading.firm_uuid IS NOT NULL
    WHERE $2::uuid IS NULL
      AND $3::uuid IS NOT NULL
      AND author_day.period = $1::date
      AND author_day.branch_uuid = $3::uuid
      AND author_day.author_kind <> 'system'
),
receipts AS (
    SELECT operation.firm_uuid AS branch_uuid,
           operation.date::date AS day,
           SUM(COALESCE(operation."values", 0))::numeric AS volume
    FROM raw.wh_operations operation
    WHERE operation.period = $1::timestamp
      AND operation.type_operation = 'Приемка'
      AND operation.firm_uuid IS NOT NULL
      AND operation.date IS NOT NULL
      AND (
          ($2::uuid IS NULL AND $3::uuid IS NULL)
          OR (
              $2::uuid IS NOT NULL
              AND operation.firm_uuid IN (SELECT employee_branch.branch_uuid FROM employee_branches employee_branch)
          )
          OR (
              $2::uuid IS NULL
              AND $3::uuid IS NOT NULL
              AND operation.firm_uuid IN (SELECT premium_branch.branch_uuid FROM premium_branches premium_branch)
          )
      )
    GROUP BY operation.firm_uuid, operation.date::date
),
schedule_days AS (
    SELECT DISTINCT schedule.branch_uuid,
           schedule.date::date AS day
    FROM raw.grafik_otgruzok schedule
    WHERE schedule.period = $1::timestamp
      AND schedule.branch_uuid IS NOT NULL
      AND schedule.date IS NOT NULL
      AND (
          ($2::uuid IS NULL AND $3::uuid IS NULL)
          OR (
              $2::uuid IS NOT NULL
              AND schedule.branch_uuid IN (SELECT employee_branch.branch_uuid FROM employee_branches employee_branch)
          )
          OR (
              $2::uuid IS NULL
              AND $3::uuid IS NOT NULL
              AND schedule.branch_uuid IN (SELECT premium_branch.branch_uuid FROM premium_branches premium_branch)
          )
      )
),
unloaders AS (
    SELECT unloading.firm_uuid AS branch_uuid,
           unloading.date::date AS day,
           unloading.author AS employee_uuid
    FROM raw.unloading_car unloading
    WHERE unloading.period = $1::timestamp
      AND unloading.firm_uuid IS NOT NULL
      AND unloading.date IS NOT NULL
      AND unloading.author IS NOT NULL
      AND (
          ($2::uuid IS NULL AND $3::uuid IS NULL)
          OR (
              $2::uuid IS NOT NULL
              AND unloading.firm_uuid IN (SELECT employee_branch.branch_uuid FROM employee_branches employee_branch)
          )
          OR (
              $2::uuid IS NULL
              AND $3::uuid IS NOT NULL
              AND unloading.firm_uuid IN (SELECT premium_branch.branch_uuid FROM premium_branches premium_branch)
          )
      )
    GROUP BY unloading.firm_uuid, unloading.date::date, unloading.author
),
unloader_counts AS (
    SELECT branch_uuid,
           day,
           COUNT(*)::int AS participants
    FROM unloaders
    GROUP BY branch_uuid, day
),
branches_in_scope AS (
    SELECT DISTINCT branch_uuid FROM receipts
    UNION
    SELECT DISTINCT branch_uuid FROM schedule_days
    UNION
    SELECT DISTINCT branch_uuid FROM unloaders
),
calendar AS (
    SELECT branch.branch_uuid,
           month_days.day,
           COALESCE(receipts.volume, 0)::numeric AS receipt_volume,
           schedule_days.branch_uuid IS NOT NULL AS has_schedule,
           COALESCE(unloader_counts.participants, 0) AS participants
    FROM branches_in_scope branch
    CROSS JOIN month_days
    LEFT JOIN receipts
        ON receipts.branch_uuid = branch.branch_uuid
       AND receipts.day = month_days.day
    LEFT JOIN schedule_days
        ON schedule_days.branch_uuid = branch.branch_uuid
       AND schedule_days.day = month_days.day
    LEFT JOIN unloader_counts
        ON unloader_counts.branch_uuid = branch.branch_uuid
       AND unloader_counts.day = month_days.day
),
marked AS MATERIALIZED (
    SELECT calendar.*,
           (calendar.has_schedule OR calendar.participants > 0) AS work_day
    FROM calendar
),
targeted AS (
    SELECT marked.branch_uuid,
           marked.day,
           marked.receipt_volume,
           marked.participants,
           marked.work_day,
           CASE
               WHEN marked.work_day THEN marked.day
               ELSE MAX(marked.day) FILTER (WHERE marked.work_day) OVER (
                   PARTITION BY marked.branch_uuid
                   ORDER BY marked.day
                   ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
               )
           END AS target_day
    FROM marked
),
attributed AS (
    SELECT targeted.branch_uuid,
           targeted.day AS source_day,
           targeted.receipt_volume,
           targeted.participants,
           targeted.work_day,
           targeted.target_day
    FROM targeted
    WHERE targeted.receipt_volume <> 0
),
day_volume AS MATERIALIZED (
    SELECT attributed.branch_uuid,
           attributed.target_day AS day,
           SUM(attributed.receipt_volume)::numeric AS volume
    FROM attributed
    WHERE attributed.target_day IS NOT NULL
    GROUP BY attributed.branch_uuid, attributed.target_day
),
paid_days AS (
    SELECT day_volume.branch_uuid AS document_branch,
           day_volume.day,
           day_volume.volume,
           unloader_counts.participants
    FROM day_volume
    JOIN unloader_counts
      ON unloader_counts.branch_uuid = day_volume.branch_uuid
     AND unloader_counts.day = day_volume.day
    WHERE unloader_counts.participants > 0
      AND day_volume.volume <> 0
),
shares AS (
    SELECT paid_days.document_branch,
           paid_days.day,
           paid_days.volume,
           paid_days.participants,
           unloaders.employee_uuid,
           (paid_days.volume / paid_days.participants::numeric) AS share_volume
    FROM paid_days
    JOIN unloaders
      ON unloaders.branch_uuid = paid_days.document_branch
     AND unloaders.day = paid_days.day
    WHERE ($2::uuid IS NULL OR unloaders.employee_uuid = $2::uuid)
      AND (
          $4::date IS NULL
          OR paid_days.day BETWEEN $4::date AND COALESCE($5::date, $4::date)
      )
),
worked AS MATERIALIZED (
    SELECT $1::date AS period,
           branch.territory_uuid,
           assignment.branch_uuid,
           assignment.author_kind,
           shares.employee_uuid,
           shares.day::timestamp AS document_date,
           shares.participants,
           shares.volume AS total_volume,
           shares.share_volume,
           rates.rate AS tariff
    FROM shares
    JOIN main.author_days author_day
        ON author_day.period = $1::date
       AND author_day.employee_uuid = shares.employee_uuid
       AND author_day.day = shares.day
    CROSS JOIN LATERAL (
        SELECT CASE
                   WHEN author_day.author_kind = 'system' THEN shares.document_branch
                   ELSE author_day.branch_uuid
               END AS branch_uuid,
               author_day.author_kind
    ) assignment
    JOIN dictionaries.branches branch ON branch.uuid = assignment.branch_uuid
    JOIN rates ON rates.territory_uuid = branch.territory_uuid
    WHERE assignment.branch_uuid IS NOT NULL
      AND ($3::uuid IS NULL OR assignment.branch_uuid = $3::uuid)
      AND ($7::uuid[] IS NULL OR assignment.branch_uuid = ANY($7::uuid[]))
),
coefficients AS MATERIALIZED (
    SELECT branch.territory_uuid,
           branch.branch_uuid,
           COALESCE(MAX(coefficient.value), 1) AS unloading_coef
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
              AND coefficient.basket_id = (SELECT id FROM unloading_basket)
              AND coefficient.territory_uuid = branch.territory_uuid
              AND coefficient.branch_uuid = branch.branch_uuid
              AND coefficient.coefficient_key = 'unloading_coef'
              AND coefficient.period <= $1::date
            UNION ALL
            SELECT frozen.value,
                   $1::date AS period
            FROM main.premium_accrual_coefficients frozen
            WHERE frozen.accrual_id = $6::bigint
              AND frozen.basket_id = (SELECT id FROM unloading_basket)
              AND frozen.coefficient_key = 'unloading_coef'
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
       worked.document_date,
       worked.participants,
       worked.total_volume,
       worked.share_volume,
       worked.tariff,
       coefficients.unloading_coef::numeric AS coefficient,
       ROUND(worked.share_volume * worked.tariff * coefficients.unloading_coef, 2) AS premium
FROM worked
JOIN coefficients
    ON coefficients.territory_uuid = worked.territory_uuid
   AND coefficients.branch_uuid = worked.branch_uuid;
