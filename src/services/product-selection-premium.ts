import { DETAIL_STATEMENT_TIMEOUT_MS } from "@/lib/detail-timeout";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import type { AccessView } from "@/server/authz/resolve-access";
import { replaceAuthorDays } from "@/services/author-days";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";
import { canReadEmployeeDetail } from "@/services/premium-access";
import { readIndicatorScriptSql } from "@/services/basket-script-sql";
import { premiumAccrualId, premiumAsOf, SalePremiumError, writeOpenPremiumDays, type PremiumRun } from "@/services/sale-premium";

const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const SELECTION_INDICATOR = "Набор товара";

export async function calculateSelectionPremium(period: string, refreshSchedule = true, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = premiumAsOf(run);
    const selectSql = await selectionSelectSql();
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (refreshSchedule) {
            await replaceAuthorDays(query, period, asOf);
        }
        return writeOpenPremiumDays(query, period, SELECTION_INDICATOR, [selectSql], { ...run, asOf });
    });
}

export async function readBranchSelectionPremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
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
          AND indicator.name = 'Набор товара'
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

export interface SelectionPremiumLine {
    id: string;
    day: string;
    setTitle: string;
    calculation: string;
    amount: number;
    employeeId?: string;
    employeeName?: string;
}

export interface SelectionPremiumDetail {
    lines: SelectionPremiumLine[];
    share?: number | null;
    members?: { id: string; name: string }[];
}

interface SelectionDetailRow {
    day: string;
    setTitle: string;
    quantityTariff: number | string;
    volumeTariff: number | string;
    itemCount: number | string;
    volume: number | string;
    premium: number | string;
    employeeId?: string | null;
}

export async function readSelectionPremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
): Promise<SelectionPremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await canReadEmployeeDetail(access, period, branchId, employeeId)) {
        return null;
    }
    const { collectBrigadeLines } = await import("@/services/brigade-detail");
    const brigade = await collectBrigadeLines(period, branchId, employeeId, from, SELECTION_INDICATOR, (input) => (
        loadSelectionLines(period, branchId, input.employeeId, input.from, input.until, input.accrualId, input.authors)
    ));
    if (brigade) {
        return brigade;
    }
    const accrualId = await premiumAccrualId(period, branchId, employeeId, from, until, SELECTION_INDICATOR);
    return { lines: await loadSelectionLines(period, branchId, employeeId, from, until, accrualId, null) };
}

async function loadSelectionLines(
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    accrualId: number | null,
    authors: string[] | null,
): Promise<SelectionPremiumLine[]> {
    const sourceSql = await selectionSelectSql();
    const brigade = authors !== null && authors.length > 0;
    const { sqlForAuthors } = brigade ? await import("@/services/brigade-detail") : { sqlForAuthors: null };
    const selectSql = sqlForAuthors ? sqlForAuthors(sourceSql) : sourceSql;
    const rows = await db.queryWithTimeout<SelectionDetailRow>(
        `
        SELECT to_char(grouped.document_date, 'DD.MM.YYYY') AS day,
               grouped.set_title AS "setTitle",
               grouped.quantity_tariff AS "quantityTariff",
               grouped.volume_tariff AS "volumeTariff",
               grouped.item_count AS "itemCount",
               grouped.volume,
               grouped.premium,
               grouped.employee_uuid::text AS "employeeId"
        FROM (
            SELECT line.document_date,
                   line.set_title,
                   line.quantity_tariff,
                   line.volume_tariff,
                   line.employee_uuid,
                   SUM(line.item_count)::float8 AS item_count,
                   SUM(line.volume)::float8 AS volume,
                   SUM(line.premium)::float8 AS premium
            FROM (
${selectSql}
            ) line
            GROUP BY line.document_date, line.employee_uuid, line.set_title, line.quantity_tariff, line.volume_tariff
        ) grouped
        ORDER BY grouped.document_date DESC, grouped.set_title
        `,
        brigade
            ? [period, null, branchId, null, null, null, null, authors]
            : [period, employeeId, branchId, from, until, accrualId, null],
        DETAIL_STATEMENT_TIMEOUT_MS,
    );
    return rows.flatMap((row, index) => {
        const quantityTariff = finiteNumber(row.quantityTariff);
        const volumeTariff = finiteNumber(row.volumeTariff);
        const itemCount = finiteNumber(row.itemCount);
        const volume = finiteNumber(row.volume);
        const amount = finiteNumber(row.premium);
        if (quantityTariff === null || volumeTariff === null || itemCount === null || volume === null || amount === null) {
            return [];
        }
        const personId = row.employeeId?.toLowerCase() ?? "";
        return [{
            id: `${personId}:${row.day}:${row.setTitle}:${index}`,
            day: row.day,
            setTitle: row.setTitle,
            calculation: `${formatMoneyFactor(quantityTariff)} × ${formatCount(itemCount)} шт + ${formatMoneyFactor(volumeTariff)} × ${formatVolume(volume)} м³`,
            amount,
            ...(personId ? { employeeId: personId } : {}),
        }];
    });
}

async function selectionSelectSql(): Promise<string> {
    const parts = await readIndicatorScriptSql(SELECTION_INDICATOR);
    if (parts.length === 0) {
        throw new SalePremiumError("Для набора товара не задан скрипт расчёта");
    }
    return parts.join("\nUNION ALL\n");
}

function finiteNumber(value: number | string): number | null {
    const amount = typeof value === "number" ? value : Number(value);
    return Number.isFinite(amount) ? amount : null;
}

function formatCount(value: number): string {
    return value.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}

function formatVolume(value: number): string {
    return value.toLocaleString("ru-RU", { maximumFractionDigits: 4 });
}

function formatMoneyFactor(value: number): string {
    return `${formatCount(value)} ₽`;
}
