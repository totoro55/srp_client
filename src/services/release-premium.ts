import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { AccessView } from "@/server/authz/resolve-access";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";
import { branchVisible, SalePremiumError } from "@/services/sale-premium";

const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const SNAPSHOT_COLUMNS = "period, territory_uuid, branch_uuid, employee_uuid, version_id, category_code, quantity_tariff, volume_tariff, item_count, volume, premium, link_doc, document_number, document_date, product_name";

export async function calculateReleasePremium(period: string): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const selectSql = (await readFile(path.join(process.cwd(), "src/services/release-premium-v1.sql"), "utf8")).replace(/;\s*$/, "");
    const params = [period, null, null, null, null];
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query("SET LOCAL statement_timeout = 0");
        await query(
            `
            DELETE FROM main.release_premium_lines
            WHERE period = $1::date
              AND version_id IN (
                  SELECT version.id
                  FROM baskets basket
                  JOIN indicators indicator ON indicator.id = basket.indicator_id
                  JOIN basket_versions version ON version.basket_id = basket.id
                  WHERE indicator.name = 'Выдача товара'
                    AND version.version_no = 1
                    AND version.data_table = 'release_v1'
              )
            `,
            [period],
        );
        await query(`INSERT INTO main.release_premium_lines (${SNAPSHOT_COLUMNS})\n${selectSql}`, params);
        const rows = await query<{ lines: number }>(
            `
            SELECT count(*)::int AS lines
            FROM main.release_premium_lines
            WHERE period = $1::date
              AND version_id IN (
                  SELECT version.id
                  FROM baskets basket
                  JOIN indicators indicator ON indicator.id = basket.indicator_id
                  JOIN basket_versions version ON version.basket_id = basket.id
                  WHERE indicator.name = 'Выдача товара'
                    AND version.version_no = 1
                    AND version.data_table = 'release_v1'
              )
            `,
            [period],
        );
        const lines = rows[0]?.lines ?? 0;
        return typeof lines === "number" ? lines : Number(lines);
    });
}

export async function readBranchReleasePremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
    const rows = await db.query<{ id: string; day: string; amount: number | string }>(
        `
        SELECT lower(employee_uuid) AS id,
               to_char(COALESCE(document_date::date, period), 'YYYY-MM-DD') AS day,
               SUM(premium)::float8 AS amount
        FROM main.release_premium_lines
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

export interface ReleasePremiumDetailLine {
    id: string;
    categoryTitle: string;
    calculation: string;
    amount: number;
    documentId: string;
    documentTitle: string;
    productName: string;
}

export interface ReleasePremiumDetailGroup {
    id: string;
    title: string;
    amount: number;
    lines: ReleasePremiumDetailLine[];
}

export interface ReleasePremiumDetailQuery {
    mode: "category" | "document";
    page: number;
    pageSize: number;
    query: string;
}

export interface ReleasePremiumDetail {
    rowLabel: string;
    groupCount: number;
    groups: ReleasePremiumDetailGroup[];
}

interface ReleaseDetailRow {
    categoryCode: string;
    categoryTitle: string;
    quantityTariff: number | string;
    volumeTariff: number | string;
    itemCount: number | string;
    volume: number | string;
    premium: number | string;
    linkDoc: string | null;
    documentNumber: string | null;
    documentDay: string | null;
    productName: string | null;
}

export async function readReleasePremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
    pageQuery: ReleasePremiumDetailQuery,
): Promise<ReleasePremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await branchVisible(access, period, branchId)) {
        return null;
    }
    const rows = await db.query<ReleaseDetailRow>(
        `
        WITH matched AS MATERIALIZED (
            SELECT line.category_code,
                   line.quantity_tariff,
                   line.volume_tariff,
                   line.item_count,
                   line.volume,
                   line.premium,
                   line.link_doc,
                   line.document_number,
                   line.document_date,
                   line.product_name
            FROM main.release_premium_lines line
            WHERE line.period = $1::date
              AND line.branch_uuid = $3::uuid
              AND line.employee_uuid = lower(btrim($2))
              AND (
                  $4::date IS NULL
                  OR COALESCE(line.document_date::date, line.period) BETWEEN $4::date AND COALESCE($5::date, $4::date)
              )
        )
        SELECT matched.category_code AS "categoryCode",
               COALESCE(category.name, NULLIF(matched.category_code, ''), 'Без категории') AS "categoryTitle",
               matched.quantity_tariff AS "quantityTariff",
               matched.volume_tariff AS "volumeTariff",
               matched.item_count AS "itemCount",
               matched.volume,
               matched.premium,
               matched.link_doc AS "linkDoc",
               matched.document_number AS "documentNumber",
               to_char(matched.document_date, 'DD.MM') AS "documentDay",
               matched.product_name AS "productName"
        FROM matched
        LEFT JOIN product_categories category
            ON category.uuid = CASE
                WHEN matched.category_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN matched.category_code::uuid
            END
        `,
        [period, employeeId, branchId, from, until],
    );
    const lines = rows.map((row, index) => {
        const documentNumber = row.documentNumber?.trim() || "Без номера";
        const documentTitle = row.documentDay ? `${documentNumber} от ${row.documentDay}` : documentNumber;
        const documentId = row.linkDoc?.trim() || `${documentNumber}|${row.documentDay ?? ""}`;
        return {
            id: `${row.categoryCode}:${documentId}:${index}`,
            categoryTitle: row.categoryTitle.trim() || "Без категории",
            calculation: calculationLabel(row),
            amount: finiteNumber(row.premium) ?? 0,
            documentId,
            documentTitle,
            productName: row.productName?.trim() || "Без названия",
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
        ? groups.filter((group) => `${group.title} ${group.lines.map((line) => `${line.productName} ${line.categoryTitle} ${line.documentTitle} ${line.calculation}`).join(" ")}`.toLowerCase().includes(needle))
        : groups;
    filtered.sort((left, right) => {
        const value = pageQuery.mode === "document"
            ? documentTime(right.title) - documentTime(left.title)
            : right.amount - left.amount;
        return value || left.id.localeCompare(right.id, "ru");
    });
    const start = pageQuery.page * pageQuery.pageSize;
    return {
        rowLabel: "Категория",
        groupCount: filtered.length,
        groups: filtered.slice(start, start + pageQuery.pageSize),
    };
}

function groupLines(
    lines: ReleasePremiumDetailLine[],
    keyOf: (line: ReleasePremiumDetailLine) => string,
    idOf: (key: string) => string,
    titleOf: (line: ReleasePremiumDetailLine) => string = (line) => line.categoryTitle,
): ReleasePremiumDetailGroup[] {
    const groups = new Map<string, ReleasePremiumDetailGroup>();
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

function calculationLabel(row: ReleaseDetailRow): string {
    const quantityTariff = finiteNumber(row.quantityTariff) ?? 0;
    const volumeTariff = finiteNumber(row.volumeTariff) ?? 0;
    const count = finiteNumber(row.itemCount) ?? 0;
    const volume = finiteNumber(row.volume) ?? 0;
    return `${formatNumber(quantityTariff)} ₽ × ${formatNumber(count)} шт + ${formatNumber(volumeTariff)} ₽ × ${formatVolume(volume)} м³`;
}

function formatNumber(value: number): string {
    return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatVolume(value: number): string {
    return value.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function finiteNumber(value: number | string | null): number | null {
    if (value === null) return null;
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}
