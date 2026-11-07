import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { AccessView } from "@/server/authz/resolve-access";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";

const PERIOD = /^\d{4}-\d{2}-01$/;

export class SalePremiumError extends Error {
    readonly status = 400;

    constructor(message: string) {
        super(message);
        this.name = "SalePremiumError";
    }
}

export async function calculateSalePremium(period: string): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const [categorySql, kindSql] = await Promise.all([
        readSaleQuery("sale-premium-category.sql"),
        readSaleQuery("sale-premium-kind.sql"),
    ]);
    const params = [period, null, null, null, null];
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query("SET LOCAL statement_timeout = 0");
        await query("DELETE FROM main.sale_premium_lines WHERE period = $1::date", [period]);
        await query(insertSaleSnapshot(categorySql), params);
        await query(insertSaleSnapshot(kindSql), params);
        const rows = await query<{ lines: number }>(
            "SELECT count(*)::int AS lines FROM main.sale_premium_lines WHERE period = $1::date",
            [period],
        );
        const lines = rows[0]?.lines ?? 0;
        return typeof lines === "number" ? lines : Number(lines);
    });
}

const SNAPSHOT_COLUMNS = "period, territory_uuid, branch_uuid, employee_uuid, version_id, axis, code, channel, base_mode, tariff, price, item_count, premium, link_doc, document_number, document_date, product_name";

async function readSaleQuery(file: "sale-premium-category.sql" | "sale-premium-kind.sql"): Promise<string> {
    const sql = await readFile(path.join(process.cwd(), "src/services", file), "utf8");
    return sql.replace(/;\s*$/, "");
}

function insertSaleSnapshot(selectSql: string): string {
    return `INSERT INTO main.sale_premium_lines (${SNAPSHOT_COLUMNS})\n${selectSql}`;
}

export async function readBranchSalePremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
    const rows = await db.query<{ id: string; day: string; amount: number | string }>(
        `
        SELECT lower(employee_uuid) AS id,
               to_char(COALESCE(document_date::date, period), 'YYYY-MM-DD') AS day,
               SUM(premium)::float8 AS amount
        FROM main.sale_premium_lines
        WHERE period = $1::date
          AND branch_uuid = $2::uuid
        GROUP BY lower(employee_uuid), COALESCE(document_date::date, period)
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
}

export interface SalePremiumDetailGroup {
    id: string;
    title: string;
    amount: number;
    lines: SalePremiumDetailLine[];
}

export interface SalePremiumDetailQuery {
    mode: "category" | "document";
    page: number;
    pageSize: number;
    query: string;
}

export interface SalePremiumDetail {
    rowLabel: string;
    groupCount: number;
    groups: SalePremiumDetailGroup[];
}

interface PremiumDetailRow {
    axis: string;
    code: string;
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
}

export async function readSalePremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
    pageQuery: SalePremiumDetailQuery,
): Promise<SalePremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await branchVisible(access, period, branchId)) {
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
    return queryPremiumPage(axis, period, branchId, employeeId, from, until, pageQuery);
}

async function queryPremiumPage(
    axis: "category" | "product_kind",
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    pageQuery: SalePremiumDetailQuery,
): Promise<SalePremiumDetail> {
    const rows = await db.query<PremiumDetailRow>(
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
                   line.product_name
            FROM main.sale_premium_lines line
            WHERE line.period = $1::date
              AND line.branch_uuid = $3::uuid
              AND line.employee_uuid = lower(btrim($2))
              AND line.axis = $6
              AND (
                  $4::date IS NULL
                  OR COALESCE(line.document_date::date, line.period) BETWEEN $4::date AND COALESCE($5::date, $4::date)
              )
        )
        SELECT matched.code,
               COALESCE(category.name, kind.name, matched.code) AS "itemTitle",
               matched.channel,
               matched.base_mode AS "baseMode",
               matched.tariff,
               matched.price,
               matched.item_count AS "itemCount",
               matched.premium,
               matched.link_doc AS "linkDoc",
               matched.document_number AS "documentNumber",
               to_char(matched.document_date, 'DD.MM') AS "documentDay",
               matched.product_name AS "productName"
        FROM matched
        LEFT JOIN product_categories category
            ON matched.axis = 'category'
           AND category.uuid = CASE
               WHEN matched.code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   THEN matched.code::uuid
           END
        LEFT JOIN product_kinds kind
            ON matched.axis = 'product_kind'
           AND kind.uuid = CASE
               WHEN matched.code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                   THEN matched.code::uuid
           END
        `,
        [period, employeeId, branchId, from, until, axis],
    );
    const lines = rows.map((row, index) => {
        const amount = finiteNumber(row.premium) ?? 0;
        const price = finiteNumber(row.price);
        const documentNumber = row.documentNumber?.trim() || "Без номера";
        const documentTitle = row.documentDay ? `${documentNumber} от ${row.documentDay}` : documentNumber;
        const documentId = row.linkDoc?.trim() || `${documentNumber}|${row.documentDay ?? ""}`;
        return {
            id: `${row.code}:${documentId}:${index}`,
            channel: channelLabel(row.channel),
            categoryTitle: row.itemTitle.trim() || "Без названия",
            calculation: calculationLabel(row),
            amount,
            documentId,
            documentTitle,
            productName: row.productName?.trim() || "Без названия",
            doubled: row.baseMode === "per_unit" && (row.channel === "stm" || row.channel === "not_stm" || row.channel === "main") && price !== null && price >= 100000,
        };
    });
    const groups = pageQuery.mode === "document"
        ? groupLines(lines, (line) => line.documentId, (id) => id, (line) => line.documentTitle)
        : groupLines(lines, (line) => line.categoryTitle, (title) => `category:${title}`);
    for (const group of groups) {
        group.lines.sort((left, right) => right.amount - left.amount || left.id.localeCompare(right.id));
        group.amount = group.lines.reduce((sum, line) => sum + line.amount, 0);
    }
    const needle = pageQuery.query.trim().toLowerCase();
    const filtered = needle
        ? groups.filter((group) => `${group.title} ${group.lines.map((line) => `${line.productName} ${line.categoryTitle} ${line.documentTitle} ${line.channel} ${line.calculation}`).join(" ")}`.toLowerCase().includes(needle))
        : groups;
    filtered.sort((left, right) => {
        const value = pageQuery.mode === "document"
            ? documentTime(right.title) - documentTime(left.title)
            : right.amount - left.amount;
        return value || left.id.localeCompare(right.id, "ru");
    });
    const start = pageQuery.page * pageQuery.pageSize;
    return {
        rowLabel: axis === "product_kind" ? "Изделие" : "Категория",
        groupCount: filtered.length,
        groups: filtered.slice(start, start + pageQuery.pageSize),
    };
}

function groupLines(
    lines: SalePremiumDetailLine[],
    keyOf: (line: SalePremiumDetailLine) => string,
    idOf: (key: string) => string,
    titleOf: (line: SalePremiumDetailLine) => string = (line) => line.categoryTitle,
): SalePremiumDetailGroup[] {
    const groups = new Map<string, SalePremiumDetailGroup>();
    for (const line of lines) {
        const key = keyOf(line);
        const current = groups.get(key);
        if (current) {
            current.lines.push(line);
            current.amount += line.amount;
            continue;
        }
        groups.set(key, { id: idOf(key), title: titleOf(line), amount: line.amount, lines: [line] });
    }
    return [...groups.values()];
}

function documentTime(title: string): number {
    const match = title.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
    if (!match) return 0;
    const day = Number(match[1]);
    const month = Number(match[2]);
    let year = match[3] ? Number(match[3]) : 2026;
    if (year < 100) year += 2000;
    return Date.UTC(year, month - 1, day);
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

export async function branchVisible(access: AccessView, period: string, branchId: string): Promise<boolean> {
    const mode = access.fullAccess || access.role?.scopeKind === "division"
        ? "all"
        : access.role?.scopeKind === "granted"
            ? "granted"
            : access.role?.scopeKind === "home_branch"
                ? "home"
                : "none";
    if (mode === "none") {
        return false;
    }
    const rows = await db.query<{ ok: number }>(
        `
        SELECT 1 AS ok
        FROM branches branch
        LEFT JOIN LATERAL (
            SELECT employee.branch_uuid
            FROM employees employee
            WHERE lower(employee.login) = lower($2)
              AND NOT employee.deleted
            LIMIT 1
        ) home ON TRUE
        WHERE branch.uuid = $4::uuid
          AND NOT branch.deleted
          AND (
              $1::text = 'all'
              OR ($1::text = 'granted' AND branch.territory_uuid IN (
                  SELECT grant_row.territory_uuid
                  FROM scope_grants grant_row
                  WHERE lower(grant_row.username) = lower($2)
              ))
              OR ($1::text = 'home' AND branch.uuid IS NOT DISTINCT FROM home.branch_uuid)
          )
          AND (
              EXISTS (
                  SELECT 1
                  FROM raw.hr_ktu staff
                  WHERE staff.period = $3::date
                    AND lower(staff.branch_uuid) = lower(branch.uuid::text)
              )
              OR branch.uuid IS NOT DISTINCT FROM home.branch_uuid
          )
        `,
        [mode, access.username, period, branchId],
    );
    return rows.length > 0;
}
