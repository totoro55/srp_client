-- Премия за продажу, ось «категория». Запрос только читает.
-- $1 — первое число месяца.
-- Колонки совпадают с sale-premium-kind.sql и со снимком main.sale_premium_lines.
-- tariff в результате — готовый тариф, коэффициенты в колонки не выводятся.
-- Запись в main.sale_premium_lines этим файлом не выполняется: результат вставляет пересчёт премии.
--
-- Уже входит в формулу:
--   последняя подключённая версия корзины «Продажа товара» с осью category;
--   тариф категории этой версии за тот же месяц;
--   безнал — ставка b2b × b2b_coef, один раз на строку, без количества и без множителя ×2;
--   интернет-магазин — ставка im × количество × im_coef,
--   автор Сайт ДНС, Сайт ДНС Быстрая продажа, Терминал продаж ДНС или Терминал продаж ТП;
--   одновременно безнал и автор интернет-магазина — применяется безнал, не интернет-магазин;
--   розница СТМ — ставка main × количество или цена × stm_coef, бренд из stm_brands;
--   розница не СТМ — ставка main × количество или цена × not_stm_coef;
--   коэффициента нет — в формуле единица;
--   розничный тариф за количество и цена от 100 000 — сумма × 2;
--   тариф от цены, интернет-магазин и безнал этот множитель не берут;
--   полученная сумма × sale_coef филиала, коэффициента нет — единица;
--   нет категории в тарифах месяца — ставка base корзины этого РРС:
--   розница и интернет-магазин за количество, безнал один раз на строку;
--   base нет — строка не входит;
--   строка без количества или без цены при ставке от цены не входит;
--   продавец — author, а для этих четырёх авторов интернет-магазина — author2;
--   отбор сотрудника идёт по автору до поиска филиала, месяц целиком не читается;
--   филиал строки — филиал продавца по raw.hr_ktu на дату документа.
--   смена должности на том же филиале начинает новый отрезок с date_modified:
--   операция до этой даты остаётся на предыдущей строке.

WITH sale_basket AS (
    SELECT basket.id
    FROM baskets basket
    JOIN indicators indicator ON indicator.id = basket.indicator_id
    WHERE indicator.name = 'Продажа товара'
    LIMIT 1
),
site_authors AS (
    SELECT author
    FROM (
        VALUES
            ('0c87a096-c966-11e5-98c0-001e674202ec'), -- Сайт ДНС
            ('bbd5fddb-df60-11ef-92d2-0050569d9cb8'), -- Сайт ДНС Быстрая продажа
            ('5cd5b357-9bdb-11e6-9a79-00155d03330d'), -- Терминал продаж ДНС
            ('cebc3680-39cb-4711-be57-ff593d309f82')  -- Терминал продаж ТП
    ) AS site (author)
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
        WHERE connection.basket_id = (SELECT id FROM sale_basket)
          AND connection.period <= $1::date
          AND connection.version_id IS NOT NULL
        ORDER BY connection.territory_uuid, connection.period DESC
    ) latest
    JOIN basket_versions version ON version.id = latest.version_id
    WHERE version.tariff_axis = 'category'
),
sale_hits AS (
    SELECT sale.*
    FROM raw.sale sale
    WHERE $2::text IS NOT NULL
      AND sale.period = $1::timestamp
      AND lower(btrim(sale.author)) = lower(btrim($2))
      AND lower(btrim(sale.author)) NOT IN (SELECT author FROM site_authors)
    UNION ALL
    SELECT sale.*
    FROM raw.sale sale
    WHERE $2::text IS NOT NULL
      AND sale.period = $1::timestamp
      AND lower(btrim(sale.author2)) = lower(btrim($2))
      AND lower(btrim(sale.author)) IN (SELECT author FROM site_authors)
    UNION ALL
    SELECT sale.*
    FROM raw.sale sale
    WHERE $2::text IS NULL
      AND sale.period = $1::timestamp
),
sale_lines AS (
    SELECT attributed.territory_uuid,
           attributed.branch_uuid,
           attributed.employee_uuid,
           attributed.version_id,
           attributed.code,
           attributed.code_uuid,
           attributed.channel,
           attributed.is_stm,
           attributed.price,
           attributed.item_count,
           attributed.link_doc,
           attributed.document_number,
           attributed.document_date,
           attributed.product_name
    FROM (
        SELECT branch.territory_uuid,
               assignment.branch_uuid,
               seller.employee_uuid,
               connected.version_id,
               lower(btrim(sale.category)) AS code,
               CASE
                   WHEN btrim(sale.category) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                       THEN lower(btrim(sale.category))::uuid
               END AS code_uuid,
               CASE
                   -- Безнал перекрывает автора интернет-магазина.
                   WHEN COALESCE(sale.b2b, FALSE) THEN 'b2b'
                   WHEN lower(btrim(sale.author)) IN (SELECT author FROM site_authors) THEN 'im'
                   ELSE 'main'
               END AS channel,
               lower(btrim(sale.brend)) IN (
                   SELECT lower(btrim(brand.name))
                   FROM stm_brands brand
               ) AS is_stm,
               sale.price,
               sale.count AS item_count,
               NULLIF(btrim(sale.name_product), '') AS product_name,
               NULLIF(btrim(sale.link_doc), '') AS link_doc,
               NULLIF(btrim(sale.document_number), '') AS document_number,
               sale.date AS document_date
        FROM sale_hits sale
        CROSS JOIN LATERAL (
            SELECT CASE
                       WHEN lower(btrim(sale.author)) IN (SELECT author FROM site_authors)
                           THEN NULLIF(lower(btrim(sale.author2)), '')
                       ELSE NULLIF(lower(btrim(sale.author)), '')
                   END AS employee_uuid
        ) seller
        JOIN LATERAL (
            SELECT lower(btrim(staff.branch_uuid))::uuid AS branch_uuid
            FROM raw.hr_ktu staff
            WHERE lower(staff.employees_uuid) = seller.employee_uuid
              AND staff.date_modified <= COALESCE(sale.date::date, $1::date)
              AND btrim(staff.branch_uuid) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            ORDER BY staff.date_modified DESC
            LIMIT 1
        ) assignment ON TRUE
        JOIN dictionaries.branches branch ON branch.uuid = assignment.branch_uuid
        JOIN connected ON connected.territory_uuid = branch.territory_uuid
        WHERE sale.period = $1::timestamp
          AND sale.count IS NOT NULL
          AND seller.employee_uuid IS NOT NULL
          AND ($3::uuid IS NULL OR assignment.branch_uuid = $3::uuid)
          AND (
              $4::date IS NULL
              OR COALESCE(sale.date::date, $1::date) BETWEEN $4::date AND COALESCE($5::date, $4::date)
          )
    ) attributed
    WHERE attributed.employee_uuid IS NOT NULL
),
territory_base AS (
    SELECT connected.territory_uuid,
           basket_data.connection_base(connected.data_table, connected.territory_uuid, $1::date) AS rate
    FROM connected
),
tariffs AS (
    SELECT sale_lines.territory_uuid,
           sale_lines.branch_uuid,
           sale_lines.employee_uuid,
           sale_lines.version_id,
           sale_lines.code,
           sale_lines.channel,
           sale_lines.is_stm,
           CASE
               WHEN sale_lines.channel = 'b2b' THEN 'per_line'
               WHEN sale_lines.channel = 'im' OR tariff.code IS NULL THEN 'per_unit'
               ELSE tariff.base_mode
           END AS base_mode,
           CASE
               WHEN tariff.code IS NULL THEN territory_base.rate
               WHEN sale_lines.channel = 'b2b' THEN tariff.b2b
               WHEN sale_lines.channel = 'im' THEN tariff.im
               ELSE tariff.main
           END AS tariff_rate,
           sale_lines.price,
           sale_lines.item_count,
           sale_lines.link_doc,
           sale_lines.document_number,
           sale_lines.document_date,
           sale_lines.product_name
    FROM sale_lines
    LEFT JOIN basket_data.basket_category_tariffs tariff
        ON tariff.territory_uuid = sale_lines.territory_uuid
       AND tariff.period = $1::date
       AND tariff.version_id = sale_lines.version_id
       AND tariff.code = sale_lines.code_uuid
    LEFT JOIN territory_base
        ON territory_base.territory_uuid = sale_lines.territory_uuid
       AND tariff.code IS NULL
),
coefficients AS (
    SELECT branch.territory_uuid,
           branch.branch_uuid,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'stm_coef'), 1) AS stm_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'not_stm_coef'), 1) AS not_stm_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'b2b_coef'), 1) AS b2b_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'im_coef'), 1) AS im_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'sale_coef'), 1) AS sale_coef
    FROM (
        SELECT DISTINCT territory_uuid, branch_uuid
        FROM tariffs
    ) branch
    LEFT JOIN LATERAL (
        SELECT DISTINCT ON (coefficient.coefficient_key)
               coefficient.coefficient_key,
               coefficient.value
        FROM basket_branch_coefficients coefficient
        WHERE coefficient.basket_id = (SELECT id FROM sale_basket)
          AND coefficient.territory_uuid = branch.territory_uuid
          AND coefficient.branch_uuid = branch.branch_uuid
          AND coefficient.coefficient_key IN ('stm_coef', 'not_stm_coef', 'b2b_coef', 'im_coef', 'sale_coef')
          AND coefficient.period <= $1::date
        ORDER BY coefficient.coefficient_key, coefficient.period DESC
    ) coefficient ON TRUE
    GROUP BY branch.territory_uuid, branch.branch_uuid
),
priced AS (
    SELECT tariffs.territory_uuid,
           tariffs.branch_uuid,
           tariffs.employee_uuid,
           tariffs.version_id,
           tariffs.code,
           tariffs.channel,
           tariffs.base_mode,
           tariffs.tariff_rate,
           tariffs.price,
           tariffs.item_count,
           CASE
               WHEN tariffs.channel = 'b2b' THEN 'b2b_coef'
               WHEN tariffs.channel = 'im' THEN 'im_coef'
               WHEN tariffs.is_stm THEN 'stm_coef'
               ELSE 'not_stm_coef'
           END AS coef_key,
           CASE
               WHEN tariffs.channel = 'b2b' THEN coefficients.b2b_coef
               WHEN tariffs.channel = 'im' THEN coefficients.im_coef
               WHEN tariffs.is_stm THEN coefficients.stm_coef
               ELSE coefficients.not_stm_coef
           END AS coef,
           coefficients.sale_coef,
           tariffs.link_doc,
           tariffs.document_number,
           tariffs.document_date,
           tariffs.product_name
    FROM tariffs
    JOIN coefficients
        ON coefficients.territory_uuid = tariffs.territory_uuid
       AND coefficients.branch_uuid = tariffs.branch_uuid
    WHERE tariffs.tariff_rate IS NOT NULL
      AND (
          tariffs.channel IN ('b2b', 'im')
          OR tariffs.base_mode = 'per_unit'
          OR tariffs.price IS NOT NULL
      )
)
SELECT $1::date AS period,
       territory_uuid,
       branch_uuid,
       employee_uuid,
       version_id,
       'category'::text AS axis,
       code,
       CASE coef_key
           WHEN 'stm_coef' THEN 'stm'
           WHEN 'im_coef' THEN 'im'
           WHEN 'b2b_coef' THEN 'b2b'
           ELSE 'not_stm'
       END AS channel,
       base_mode,
       (
           tariff_rate
           * coef
           * CASE
               WHEN channel = 'main' AND base_mode = 'per_unit' AND price >= 100000 THEN 2
               ELSE 1
           END
           * sale_coef
       )::numeric AS tariff,
       price,
       item_count,
       ROUND((
           CASE
               WHEN base_mode = 'per_line'
                   THEN tariff_rate * coef
               WHEN channel = 'im' OR base_mode = 'per_unit'
                   THEN tariff_rate * item_count::numeric * coef
               ELSE tariff_rate * price::numeric * item_count::numeric * coef
           END
           * CASE
               WHEN channel = 'main' AND base_mode = 'per_unit' AND price >= 100000 THEN 2
               ELSE 1
           END
           * sale_coef
       )::numeric, 2) AS premium,
       link_doc,
       document_number,
       document_date,
       product_name
FROM priced;
