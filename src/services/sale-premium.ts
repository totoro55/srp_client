import { readFile } from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";
import { DETAIL_STATEMENT_TIMEOUT_MS } from "@/lib/detail-timeout";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { AccessView } from "@/server/authz/resolve-access";
import { canReadEmployeeDetail } from "@/services/premium-access";
import { replaceAuthorDays } from "@/services/author-days";
import { moscowToday, prepareClosedSegments } from "@/services/segment-locks";
import type { StaffLockReason } from "@/lib/recalc-window";
import { assignmentSql } from "@/services/promoter-premium";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";

export { branchVisible } from "@/services/premium-access";

const PERIOD = /^\d{4}-\d{2}-01$/;
const SALE_INDICATOR = "Продажа товара";

const OPEN_DAYS_DELETE = `
    DELETE FROM main.basket_premium_days day
    WHERE day.period = $1::date
      AND day.basket_id = (
          SELECT basket.id
          FROM baskets basket
          JOIN indicators indicator ON indicator.id = basket.indicator_id
          WHERE indicator.name = $2
          LIMIT 1
      )
      AND ($3::date IS NULL OR day.day BETWEEN $3::date AND COALESCE($4::date, $3::date))
      AND ($5::uuid IS NULL OR day.branch_uuid = $5::uuid)
      AND ($6::uuid[] IS NULL OR day.branch_uuid = ANY($6::uuid[]))
      AND NOT EXISTS (
          SELECT 1
          FROM main.premium_accruals accrual
          WHERE accrual.period = day.period
            AND accrual.employee_uuid = day.employee_uuid
            AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = day.branch_uuid)
            AND day.day BETWEEN accrual.active_from AND accrual.active_until
      )
      AND NOT EXISTS (
          SELECT 1
          FROM closed_staff_segments closed
          WHERE closed.employee_uuid = day.employee_uuid
            AND closed.branch_uuid = day.branch_uuid
            AND day.day BETWEEN closed.active_from AND closed.active_until
      )
`;

const ACCRUAL_LINK = `
    UPDATE main.basket_premium_days day
    SET accrual_id = accrual.id
    FROM main.premium_accruals accrual
    WHERE day.period = $1::date
      AND day.basket_id = (
          SELECT basket.id
          FROM baskets basket
          JOIN indicators indicator ON indicator.id = basket.indicator_id
          WHERE indicator.name = $2
          LIMIT 1
      )
      AND day.accrual_id IS NULL
      AND accrual.period = day.period
      AND accrual.employee_uuid = day.employee_uuid
      AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = day.branch_uuid)
      AND day.day BETWEEN accrual.active_from AND accrual.active_until
`;

const DAY_COUNT = `
    SELECT count(*)::int AS lines
    FROM main.basket_premium_days day
    WHERE day.period = $1::date
      AND day.basket_id = (
          SELECT basket.id
          FROM baskets basket
          JOIN indicators indicator ON indicator.id = basket.indicator_id
          WHERE indicator.name = $2
          LIMIT 1
      )
      AND ($3::uuid IS NULL OR day.branch_uuid = $3::uuid)
      AND ($4::uuid[] IS NULL OR day.branch_uuid = ANY($4::uuid[]))
`;

export function premiumDayInsertSql(selectSql: string, indicatorName: string): string {
    const indicator = indicatorName.replaceAll("'", "''");
    return `
        INSERT INTO main.basket_premium_days (
            period, territory_uuid, branch_uuid, employee_uuid, basket_id, day, premium, author_kind
        )
        SELECT priced_line.period,
               priced_line.territory_uuid,
               priced_line.branch_uuid,
               priced_line.employee_uuid,
               basket.id,
               COALESCE(priced_line.document_date::date, priced_line.period),
               ROUND(SUM(priced_line.premium), 2),
               priced_line.author_kind
        FROM (
${selectSql}
        ) priced_line
        JOIN baskets basket ON basket.id = (
            SELECT found.id
            FROM baskets found
            JOIN indicators indicator ON indicator.id = found.indicator_id
            WHERE indicator.name = '${indicator}'
            LIMIT 1
        )
        WHERE priced_line.author_kind IN ('staff', 'promoter', 'system')
          AND NOT EXISTS (
            SELECT 1
            FROM main.premium_accruals accrual
            WHERE accrual.period = priced_line.period
              AND accrual.employee_uuid = priced_line.employee_uuid
              AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = priced_line.branch_uuid)
              AND COALESCE(priced_line.document_date::date, priced_line.period)
                  BETWEEN accrual.active_from AND accrual.active_until
        )
          AND NOT EXISTS (
            SELECT 1
            FROM closed_staff_segments closed
            JOIN main.basket_premium_days existing
                ON existing.period = priced_line.period
               AND existing.basket_id = basket.id
               AND existing.branch_uuid = priced_line.branch_uuid
               AND existing.employee_uuid = priced_line.employee_uuid
               AND existing.day = COALESCE(priced_line.document_date::date, priced_line.period)
               AND existing.author_kind = priced_line.author_kind
            WHERE closed.employee_uuid = priced_line.employee_uuid
              AND closed.branch_uuid = priced_line.branch_uuid
              AND COALESCE(priced_line.document_date::date, priced_line.period)
                  BETWEEN closed.active_from AND closed.active_until
        )
        GROUP BY priced_line.period,
                 priced_line.territory_uuid,
                 priced_line.branch_uuid,
                 priced_line.employee_uuid,
                 priced_line.author_kind,
                 basket.id,
                 COALESCE(priced_line.document_date::date, priced_line.period)
    `;
}

type PremiumQuery = <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

const PRICED_LINES = `
    CREATE TEMP TABLE IF NOT EXISTS priced_premium_lines (
        period date,
        territory_uuid uuid,
        branch_uuid uuid,
        employee_uuid uuid,
        author_kind text,
        document_date timestamp,
        premium numeric
    ) ON COMMIT DROP
`;

function dayInsertFromTemp(indicatorName: string): string {
    return premiumDayInsertSql("SELECT * FROM priced_premium_lines", indicatorName)
        .replace("FROM (\nSELECT * FROM priced_premium_lines\n        ) priced_line", "FROM priced_premium_lines priced_line");
}

export interface PremiumRun {
    asOf?: string;
    from?: string;
    until?: string;
    allowClosed?: boolean;
    earliest?: string;
    /** Пусто — все филиалы. Иначе удаляются и записываются только дни этого филиала. */
    branch?: string;
    /** Несколько филиалов одной территории. Пустой список не задевает чужие филиалы. */
    branches?: string[];
    /** Пусто — закрыты увольнение, перевод и смена должности. Пустой список пересчитывает все три. */
    protect?: readonly StaffLockReason[];
    /** Лимит statement_timeout для этого пересчёта, мс. */
    timeoutMs?: number;
}

export function premiumAsOf(run?: PremiumRun): string {
    const asOf = run?.asOf ?? moscowToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
        throw new SalePremiumError("Укажите день расчёта");
    }
    return asOf;
}

export async function writeOpenPremiumDays(
    query: PremiumQuery,
    period: string,
    indicatorName: string,
    selects: string[],
    run?: PremiumRun,
): Promise<number> {
    const asOf = premiumAsOf(run);
    const from = run?.from ?? null;
    const until = run?.until ?? null;
    const earliest = run?.earliest ?? period;
    const branch = run?.branch ?? null;
    const branches = branch || !run?.branches ? null : run.branches;
    await prepareClosedSegments(query, asOf, earliest, run?.protect);
    const lineParams = [period, null, branch, from, until, null, branches];
    await query(PRICED_LINES);
    await query(OPEN_DAYS_DELETE, [period, indicatorName, from, until, branch, branches]);
    for (const selectSql of selects) {
        await query("TRUNCATE priced_premium_lines");
        await query(
            `
            INSERT INTO priced_premium_lines (
                period, territory_uuid, branch_uuid, employee_uuid, author_kind, document_date, premium
            )
            SELECT line.period,
                   line.territory_uuid,
                   line.branch_uuid,
                   line.employee_uuid,
                   line.author_kind,
                   line.document_date,
                   line.premium
            FROM (
${selectSql}
            ) line
            `,
            lineParams,
        );
        await query(dayInsertFromTemp(indicatorName));
    }
    await query(ACCRUAL_LINK, [period, indicatorName]);
    const rows = await query<{ lines: number }>(DAY_COUNT, [period, indicatorName, branch, branches]);
    const lines = rows[0]?.lines ?? 0;
    return typeof lines === "number" ? lines : Number(lines);
}

export async function premiumAccrualId(
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    indicatorName: string,
): Promise<number | null> {
    if (!from) {
        return null;
    }
    const rows = await db.query<{ id: number }>(
        `
        SELECT accrual.id
        FROM main.premium_accruals accrual
        WHERE accrual.period = $1::date
          AND accrual.employee_uuid = $2::uuid
          AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = $3::uuid)
          AND accrual.active_from <= $4::date
          AND accrual.active_until >= COALESCE($5::date, $4::date)
          AND EXISTS (
              SELECT 1
              FROM main.premium_accrual_coefficients frozen
              JOIN baskets basket ON basket.id = frozen.basket_id
              JOIN indicators indicator ON indicator.id = basket.indicator_id
              WHERE frozen.accrual_id = accrual.id
                AND indicator.name = $6
          )
        ORDER BY accrual.accrued_at DESC
        LIMIT 1
        `,
        [period, employeeId, branchId, from, until, indicatorName],
    );
    return rows[0]?.id ?? null;
}

export class SalePremiumError extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = "SalePremiumError";
    }
}

export async function calculateSalePremium(period: string, refreshSchedule = true, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = premiumAsOf(run);
    const [categorySql, kindSql] = await Promise.all([
        readSaleQuery("sale-premium-category.sql"),
        readSaleQuery("sale-premium-kind.sql"),
    ]);
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (refreshSchedule) {
            await replaceAuthorDays(query, period, asOf);
        }
        return writeOpenPremiumDays(query, period, SALE_INDICATOR, [categorySql, kindSql], { ...run, asOf });
    });
}

const saleSqlCache = new Map<string, string>();

async function readSaleQuery(file: "sale-premium-category.sql" | "sale-premium-kind.sql"): Promise<string> {
    const cached = saleSqlCache.get(file);
    if (cached) {
        return cached;
    }
    const sql = (await readFile(path.join(process.cwd(), "src/services", file), "utf8")).replace(/;\s*$/, "");
    saleSqlCache.set(file, sql);
    return sql;
}

export async function sumDocumentBranchSalePremium(period: string, branchId: string, employeeId: string): Promise<number> {
    const axis = await saleAxis(period, branchId);
    if (!axis) {
        return 0;
    }
    const selectSql = await readSaleQuery(axis === "product_kind" ? "sale-premium-kind.sql" : "sale-premium-category.sql");
    return sumPremium(selectSql, period, branchId, employeeId);
}

async function saleAxis(period: string, branchId: string): Promise<"category" | "product_kind" | null> {
    const rows = await db.query<{ axis: string | null }>(
        `
        SELECT version.tariff_axis AS axis
        FROM branches branch
        JOIN LATERAL (
            SELECT connection.version_id
            FROM basket_connections connection
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE indicator.name = 'Продажа товара'
              AND connection.territory_uuid = branch.territory_uuid
              AND connection.period <= $1::date
              AND connection.version_id IS NOT NULL
            ORDER BY connection.period DESC
            LIMIT 1
        ) connection ON TRUE
        JOIN basket_versions version ON version.id = connection.version_id
        WHERE branch.uuid = $2::uuid
        `,
        [period, branchId],
    );
    const axis = rows[0]?.axis;
    return axis === "product_kind" || axis === "category" ? axis : null;
}

async function sumPremium(selectSql: string, period: string, branchId: string, employeeId: string): Promise<number> {
    const rows = await db.query<{ premium: number | string }>(
        `
        SELECT COALESCE(SUM(line.premium), 0)::float8 AS premium
        FROM (
${selectSql}
        ) line
        `,
        [period, employeeId, branchId, null, null, null, null],
    );
    const premium = rows[0]?.premium;
    const amount = typeof premium === "number" ? premium : Number(premium);
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

export async function readBranchSalePremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
    const rows = await db.query<{ id: string; day: string; amount: number | string }>(
        `
        SELECT day.employee_uuid AS id,
               to_char(day.day, 'YYYY-MM-DD') AS day,
               day.premium::float8 AS amount
        FROM main.basket_premium_days day
        JOIN baskets basket ON basket.id = day.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        WHERE day.period = $1::date
          AND day.branch_uuid = $2::uuid
          AND day.author_kind = 'staff'
          AND indicator.name = 'Продажа товара'
        `,
        [period, branchId],
    );
    return rows.flatMap((row) => {
        const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
        if (!Number.isFinite(amount)) {
            return [];
        }
        return [{ id: row.id, day: row.day, amount }];
    });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export interface SalePremiumDetailLine {
    id: string;
    channel: string;
    categoryTitle: string;
    calculation: string;
    amount: number;
    documentId: string;
    documentTitle: string;
    productName: string;
    doubled: boolean;
    employeeId?: string;
    employeeName?: string;
}

export interface SalePremiumDetail {
    rowLabel: string;
    lines: SalePremiumDetailLine[];
    share?: number | null;
    members?: { id: string; name: string }[];
}

interface PremiumDetailRow {
    axis: string;
    code: string | null;
    itemTitle: string;
    channel: string;
    baseMode: string;
    tariff: number | string;
    price: number | string | null;
    itemCount: number | string;
    premium: number | string;
    linkDoc: string | null;
    documentNumber: string | null;
    documentDay: string | null;
    productName: string | null;
    employeeId?: string | null;
}

export async function readSalePremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
): Promise<SalePremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await canReadEmployeeDetail(access, period, branchId, employeeId)) {
        return null;
    }
    const axisRows = await db.query<{ axis: string | null }>(
        `
        SELECT version.tariff_axis AS axis
        FROM branches branch
        JOIN LATERAL (
            SELECT connection.version_id
            FROM basket_connections connection
            JOIN baskets basket ON basket.id = connection.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE indicator.name = 'Продажа товара'
              AND connection.territory_uuid = branch.territory_uuid
              AND connection.period <= $1::date
              AND connection.version_id IS NOT NULL
            ORDER BY connection.period DESC
            LIMIT 1
        ) connection ON TRUE
        JOIN basket_versions version ON version.id = connection.version_id
        WHERE branch.uuid = $2::uuid
        `,
        [period, branchId],
    );
    const axis = axisRows[0]?.axis === "product_kind" ? "product_kind" : axisRows[0]?.axis === "category" ? "category" : null;
    if (!axis) {
        return null;
    }
    const accrualId = await premiumAccrualId(period, branchId, employeeId, from, until, SALE_INDICATOR);
    const { readBrigadeDetailScope, liveBrigadeIds, frozenBrigadeSegments } = await import("@/services/brigade-detail");
    const scope = await readBrigadeDetailScope(period, branchId, employeeId, from, SALE_INDICATOR);
    if (!scope) {
        return queryPremiumPage(axis, period, branchId, employeeId, from, until, accrualId, null, null);
    }
    const names = new Map(scope.members.map((member) => [member.id, member.name]));
    const live = liveBrigadeIds(scope.members);
    const frozen = frozenBrigadeSegments(scope.members);
    const pages = await Promise.all([
        live.length > 0
            ? queryPremiumPage(axis, period, branchId, employeeId, null, null, null, live, names)
            : Promise.resolve({ rowLabel: axis === "product_kind" ? "Изделие" : "Категория", lines: [] }),
        ...frozen.map((segment) => queryPremiumPage(
            axis,
            period,
            branchId,
            segment.id,
            segment.from,
            segment.until,
            segment.accrualId,
            null,
            names,
        )),
    ]);
    return {
        rowLabel: axis === "product_kind" ? "Изделие" : "Категория",
        lines: pages.flatMap((page) => page.lines),
        share: scope.share,
        members: scope.members.map((member) => ({ id: member.id, name: member.name })),
    };
}

async function queryPremiumPage(
    axis: "category" | "product_kind",
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    accrualId: number | null,
    authorIds: string[] | null,
    names: Map<string, string> | null,
): Promise<SalePremiumDetail> {
    const sourceSql = await readSaleQuery(axis === "product_kind" ? "sale-premium-kind.sql" : "sale-premium-category.sql");
    const assigned = await assignmentSql(sourceSql, period, employeeId);
    const brigade = authorIds !== null && authorIds.length > 0;
    const { sqlForAuthors } = brigade ? await import("@/services/brigade-detail") : { sqlForAuthors: null };
    const selectSql = sqlForAuthors ? sqlForAuthors(assigned) : assigned;
    const rows = await db.queryWithTimeout<PremiumDetailRow>(
        `
        WITH matched AS MATERIALIZED (
            SELECT line.code,
                   line.axis,
                   line.channel,
                   line.base_mode,
                   line.tariff,
                   line.price,
                   line.item_count,
                   line.premium,
                   line.link_doc,
                   line.document_number,
                   line.document_date,
                   line.product_name,
                   line.employee_uuid
            FROM (
${selectSql}
            ) line
        )
        SELECT matched.code,
               COALESCE(category.name, kind.name, matched.code::text, 'Без названия') AS "itemTitle",
               matched.channel,
               matched.base_mode AS "baseMode",
               matched.tariff,
               matched.price,
               matched.item_count AS "itemCount",
               matched.premium,
               matched.link_doc AS "linkDoc",
               matched.document_number AS "documentNumber",
               to_char(matched.document_date, 'DD.MM') AS "documentDay",
               matched.product_name AS "productName",
               matched.employee_uuid::text AS "employeeId"
        FROM matched
        LEFT JOIN product_categories category
            ON matched.axis = 'category'
           AND category.uuid = matched.code
        LEFT JOIN product_kinds kind
            ON matched.axis = 'product_kind'
           AND kind.uuid = matched.code
        `,
        brigade
            ? [period, null, branchId, null, null, null, null, authorIds]
            : [period, employeeId, branchId, from, until, accrualId, null],
        DETAIL_STATEMENT_TIMEOUT_MS,
        // Тарифы месяца соединяются одним проходом. Вложенный цикл читает весь список на каждую строку.
        { hashJoins: true },
    );
    const lines = rows.flatMap((row, index) => {
        const amount = finiteNumber(row.premium) ?? 0;
        if (amount === 0) {
            return [];
        }
        const price = finiteNumber(row.price);
        const documentNumber = row.documentNumber?.trim() || "Без номера";
        const documentTitle = row.documentDay ? `${documentNumber} от ${row.documentDay}` : documentNumber;
        const documentId = row.linkDoc?.trim() || `${documentNumber}|${row.documentDay ?? ""}`;
        const personId = row.employeeId?.toLowerCase() ?? "";
        const personName = names?.get(personId) ?? "";
        return [{
            id: `${personId}:${row.code ?? ""}:${documentId}:${index}`,
            channel: channelLabel(row.channel),
            categoryTitle: row.itemTitle.trim() || "Без названия",
            calculation: calculationLabel(row),
            amount,
            documentId,
            documentTitle,
            productName: row.productName?.trim() || "Без названия",
            doubled: row.baseMode === "per_unit" && (row.channel === "stm" || row.channel === "not_stm" || row.channel === "main") && price !== null && price >= 100000,
            ...(personName ? { employeeId: personId, employeeName: personName } : {}),
        }];
    });
    return {
        rowLabel: axis === "product_kind" ? "Изделие" : "Категория",
        lines,
    };
}

function calculationLabel(row: PremiumDetailRow): string {
    const tariff = finiteNumber(row.tariff) ?? 0;
    const count = finiteNumber(row.itemCount) ?? 0;
    const price = finiteNumber(row.price);
    if (row.baseMode === "percent") {
        return `${formatPercent(tariff)} × ${formatNumber(price ?? 0)} ₽ × ${formatNumber(count)} шт`;
    }
    if (row.baseMode === "per_line") {
        return `${formatNumber(tariff)} ₽ × 1 строка`;
    }
    return `${formatNumber(tariff)} ₽ × ${formatNumber(count)} шт`;
}

function channelLabel(channel: string): string {
    if (channel === "stm") return "СТМ";
    if (channel === "im") return "ИМ";
    if (channel === "b2b") return "Безнал";
    if (channel === "main") return "Розница";
    return "не СТМ";
}

function formatNumber(value: number): string {
    return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatPercent(rate: number): string {
    return `${(rate * 100).toLocaleString("ru-RU", { maximumFractionDigits: 4 })}%`;
}

function finiteNumber(value: number | string | null): number | null {
    if (value === null) return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}

