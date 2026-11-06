-- Премия за продажу, ось «категория». Запрос только читает.
-- $1 — первое число месяца.
-- Колонки совпадают с sale-premium-kind.sql.
-- Запись в main.sale_premium_lines этим файлом не выполняется.
--
-- Уже входит в формулу:
--   последняя подключённая версия корзины «Продажа товара» с осью category;
--   тариф категории этой версии за тот же месяц;
--   безнал — ставка b2b × количество × b2b_coef;
--   интернет-магазин — ставка im × количество × im_coef,
--   автор Сайт ДНС, Сайт ДНС Быстрая продажа, Терминал продаж ДНС или Терминал продаж ТП;
--   розница СТМ — ставка main × количество или цена × stm_coef, бренд из stm_brands;
--   розница не СТМ — ставка main × количество или цена × not_stm_coef;
--   коэффициента нет — в формуле единица;
--   строка без тарифа, без количества или без цены при ставке от цены не входит;
--   продавец — author, а для этих четырёх авторов интернет-магазина — author2;
--   филиал строки — филиал продавца по raw.hr_ktu на дату документа.
--   смена должности на том же филиале начинает новый отрезок с date_modified:
--   операция до этой даты остаётся на предыдущей строке.
-- Позже: удвоение количества.

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
           latest.version_id
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
           attributed.document_date
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
               NULLIF(btrim(sale.link_doc), '') AS link_doc,
               NULLIF(btrim(sale.document_number), '') AS document_number,
               sale.date AS document_date
        FROM raw.sale sale
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
    ) attributed
    WHERE attributed.employee_uuid IS NOT NULL
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
               WHEN sale_lines.channel IN ('b2b', 'im') THEN 'per_unit'
               ELSE tariff.base_mode
           END AS base_mode,
           CASE sale_lines.channel
               WHEN 'b2b' THEN tariff.b2b
               WHEN 'im' THEN tariff.im
               ELSE tariff.main
           END AS tariff_rate,
           sale_lines.price,
           sale_lines.item_count,
           sale_lines.link_doc,
           sale_lines.document_number,
           sale_lines.document_date
    FROM sale_lines
    JOIN basket_data.basket_category_tariffs tariff
        ON tariff.territory_uuid = sale_lines.territory_uuid
       AND tariff.period = $1::date
       AND tariff.version_id = sale_lines.version_id
       AND tariff.code = sale_lines.code_uuid
),
coefficients AS (
    SELECT branch.territory_uuid,
           branch.branch_uuid,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'stm_coef'), 1) AS stm_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'not_stm_coef'), 1) AS not_stm_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'b2b_coef'), 1) AS b2b_coef,
           COALESCE(MAX(coefficient.value) FILTER (WHERE coefficient.coefficient_key = 'im_coef'), 1) AS im_coef
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
          AND coefficient.coefficient_key IN ('stm_coef', 'not_stm_coef', 'b2b_coef', 'im_coef')
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
           tariffs.link_doc,
           tariffs.document_number,
           tariffs.document_date
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
       channel,
       base_mode,
       tariff_rate AS tariff,
       price,
       item_count,
       coef_key,
       coef,
       ROUND(
           CASE
               WHEN channel IN ('b2b', 'im') OR base_mode = 'per_unit'
                   THEN tariff_rate * item_count::numeric * coef
               ELSE tariff_rate * price::numeric * item_count::numeric * coef
           END,
           2
       ) AS premium,
       link_doc,
       document_number,
       document_date
FROM priced;
