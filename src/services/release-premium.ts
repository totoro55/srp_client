import { DETAIL_STATEMENT_TIMEOUT_MS } from "@/lib/detail-timeout";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { AccessView } from "@/server/authz/resolve-access";
import { replaceAuthorDays } from "@/services/author-days";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";
import { readIndicatorScriptSql } from "@/services/basket-script-sql";
import { assignmentSql } from "@/services/promoter-premium";
import { canReadEmployeeDetail } from "@/services/premium-access";
import { premiumAccrualId, premiumAsOf, SalePremiumError, writeOpenPremiumDays, type PremiumRun } from "@/services/sale-premium";

const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const RELEASE_INDICATOR = "Выдача товара";

export async function calculateReleasePremium(period: string, refreshSchedule = true, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = premiumAsOf(run);
    const selectSql = await releaseSelectSql();
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (refreshSchedule) {
            await replaceAuthorDays(query, period, asOf);
        }
        return writeOpenPremiumDays(query, period, RELEASE_INDICATOR, [selectSql], { ...run, asOf });
    });
}

export async function sumDocumentBranchReleasePremium(period: string, branchId: string, employeeId: string): Promise<number> {
    const selectSql = await releaseSelectSql();
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

export async function readBranchReleasePremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
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
          AND indicator.name = 'Выдача товара'
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
    employeeId?: string;
    employeeName?: string;
}

export interface ReleasePremiumDetail {
    rowLabel: string;
    lines: ReleasePremiumDetailLine[];
    share?: number | null;
    members?: { id: string; name: string }[];
}

interface ReleaseDetailRow {
    categoryCode: string | null;
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
    employeeId?: string | null;
}

export async function readReleasePremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
): Promise<ReleasePremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await canReadEmployeeDetail(access, period, branchId, employeeId)) {
        return null;
    }
    const { collectBrigadeLines } = await import("@/services/brigade-detail");
    const brigade = await collectBrigadeLines(period, branchId, employeeId, from, RELEASE_INDICATOR, (input) => (
        loadReleaseLines(period, branchId, input.employeeId, input.from, input.until, input.accrualId, input.authors)
    ));
    if (brigade) {
        return { rowLabel: "Категория", ...brigade };
    }
    const accrualId = await premiumAccrualId(period, branchId, employeeId, from, until, RELEASE_INDICATOR);
    return {
        rowLabel: "Категория",
        lines: await loadReleaseLines(period, branchId, employeeId, from, until, accrualId, null),
    };
}

async function loadReleaseLines(
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    accrualId: number | null,
    authors: string[] | null,
): Promise<ReleasePremiumDetailLine[]> {
    const sourceSql = await releaseSelectSql();
    const assigned = await assignmentSql(sourceSql, period, employeeId);
    const brigade = authors !== null && authors.length > 0;
    const { sqlForAuthors } = brigade ? await import("@/services/brigade-detail") : { sqlForAuthors: null };
    const selectSql = sqlForAuthors ? sqlForAuthors(assigned) : assigned;
    const rows = await db.queryWithTimeout<ReleaseDetailRow>(
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
                   line.product_name,
                   line.employee_uuid
            FROM (
${selectSql}
            ) line
        )
        SELECT matched.category_code::text AS "categoryCode",
               COALESCE(category.name, 'Без категории') AS "categoryTitle",
               matched.quantity_tariff AS "quantityTariff",
               matched.volume_tariff AS "volumeTariff",
               matched.item_count AS "itemCount",
               matched.volume,
               matched.premium,
               matched.link_doc AS "linkDoc",
               matched.document_number AS "documentNumber",
               to_char(matched.document_date, 'DD.MM') AS "documentDay",
               matched.product_name AS "productName",
               matched.employee_uuid::text AS "employeeId"
        FROM matched
        LEFT JOIN product_categories category
            ON category.uuid = matched.category_code
        `,
        brigade
            ? [period, null, branchId, null, null, null, null, authors]
            : [period, employeeId, branchId, from, until, accrualId, null],
        DETAIL_STATEMENT_TIMEOUT_MS,
    );
    return rows.map((row, index) => {
        const documentNumber = row.documentNumber?.trim() || "Без номера";
        const documentTitle = row.documentDay ? `${documentNumber} от ${row.documentDay}` : documentNumber;
        const documentId = row.linkDoc?.trim() || `${documentNumber}|${row.documentDay ?? ""}`;
        const personId = row.employeeId?.toLowerCase() ?? "";
        return {
            id: `${personId}:${row.categoryCode ?? ""}:${documentId}:${index}`,
            categoryTitle: row.categoryTitle.trim() || "Без категории",
            calculation: calculationLabel(row),
            amount: finiteNumber(row.premium) ?? 0,
            documentId,
            documentTitle,
            productName: row.productName?.trim() || "Без названия",
            ...(brigade || personId ? { employeeId: personId } : {}),
        };
    });
}

async function releaseSelectSql(): Promise<string> {
    const parts = await readIndicatorScriptSql(RELEASE_INDICATOR);
    if (parts.length === 0) {
        throw new SalePremiumError("Для выдачи не задан скрипт расчёта");
    }
    return parts.join("\nUNION ALL\n");
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
