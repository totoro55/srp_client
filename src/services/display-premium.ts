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

export const DISPLAY_INDICATOR = "Выставление товара";

export async function calculateDisplayPremium(period: string, refreshSchedule = true, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = premiumAsOf(run);
    const selectSql = await displaySelectSql();
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (refreshSchedule) {
            await replaceAuthorDays(query, period, asOf);
        }
        return writeOpenPremiumDays(query, period, DISPLAY_INDICATOR, [selectSql], { ...run, asOf });
    });
}

export async function readBranchDisplayPremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
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
          AND indicator.name = 'Выставление товара'
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

export interface DisplayPremiumLine {
    id: string;
    day: string;
    title: string;
    calculation: string;
    amount: number;
    employeeId?: string;
    employeeName?: string;
}

export interface DisplayPremiumDetail {
    lines: DisplayPremiumLine[];
    share?: number | null;
    members?: { id: string; name: string }[];
}

interface DisplayDetailRow {
    day: string;
    zoneTitle: string;
    quantityTariff: number | string;
    volumeTariff: number | string;
    zoneItemCount: number | string;
    zoneVolume: number | string;
    participants: number | string;
    premium: number | string;
    employeeId?: string | null;
}

export async function readDisplayPremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
): Promise<DisplayPremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await canReadEmployeeDetail(access, period, branchId, employeeId)) {
        return null;
    }
    const { collectBrigadeLines } = await import("@/services/brigade-detail");
    const brigade = await collectBrigadeLines(period, branchId, employeeId, from, DISPLAY_INDICATOR, (input) => (
        loadDisplayLines(period, branchId, input.employeeId, input.from, input.until, input.accrualId, input.authors)
    ));
    if (brigade) {
        return brigade;
    }
    const accrualId = await premiumAccrualId(period, branchId, employeeId, from, until, DISPLAY_INDICATOR);
    return { lines: await loadDisplayLines(period, branchId, employeeId, from, until, accrualId, null) };
}

async function loadDisplayLines(
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    accrualId: number | null,
    authors: string[] | null,
): Promise<DisplayPremiumLine[]> {
    const sourceSql = await displaySelectSql();
    const brigade = authors !== null && authors.length > 0;
    const { sqlForAuthors } = brigade ? await import("@/services/brigade-detail") : { sqlForAuthors: null };
    const selectSql = sqlForAuthors ? sqlForAuthors(sourceSql) : sourceSql;
    const rows = await db.queryWithTimeout<DisplayDetailRow>(
        `
        SELECT to_char(line.document_date, 'DD.MM.YYYY') AS day,
               line.zone_title AS "zoneTitle",
               line.quantity_tariff AS "quantityTariff",
               line.volume_tariff AS "volumeTariff",
               line.zone_item_count AS "zoneItemCount",
               line.zone_volume AS "zoneVolume",
               line.participants,
               line.premium,
               line.employee_uuid::text AS "employeeId"
        FROM (
${selectSql}
        ) line
        ORDER BY line.document_date DESC, line.zone_title
        `,
        brigade
            ? [period, null, branchId, null, null, null, null, authors]
            : [period, employeeId, branchId, from, until, accrualId, null],
        DETAIL_STATEMENT_TIMEOUT_MS,
    );
    return rows.flatMap((row, index) => {
        const quantityTariff = finiteNumber(row.quantityTariff);
        const volumeTariff = finiteNumber(row.volumeTariff);
        const zoneItemCount = finiteNumber(row.zoneItemCount);
        const zoneVolume = finiteNumber(row.zoneVolume);
        const participants = finiteNumber(row.participants);
        const amount = finiteNumber(row.premium);
        if (
            quantityTariff === null
            || volumeTariff === null
            || zoneItemCount === null
            || zoneVolume === null
            || participants === null
            || participants <= 0
            || amount === null
        ) {
            return [];
        }
        const personId = row.employeeId?.toLowerCase() ?? "";
        return [{
            id: `${personId}:${row.day}:${row.zoneTitle}:${index}`,
            day: row.day,
            title: row.zoneTitle,
            calculation: displayCalculation(zoneVolume, zoneItemCount, participants, volumeTariff, quantityTariff),
            amount,
            ...(personId ? { employeeId: personId } : {}),
        }];
    });
}

async function displaySelectSql(): Promise<string> {
    const parts = await readIndicatorScriptSql(DISPLAY_INDICATOR);
    if (parts.length === 0) {
        throw new SalePremiumError("Для выставления товара не задан скрипт расчёта");
    }
    return parts.join("\nUNION ALL\n");
}

function finiteNumber(value: number | string): number | null {
    const amount = typeof value === "number" ? value : Number(value);
    return Number.isFinite(amount) ? amount : null;
}

function displayCalculation(
    zoneVolume: number,
    zoneItemCount: number,
    participants: number,
    volumeTariff: number,
    quantityTariff: number,
): string {
    const people = formatCount(participants);
    return `${formatVolume(zoneVolume)} м³ / ${people} × ${formatMoneyFactor(volumeTariff)} + ${formatCount(zoneItemCount)} шт / ${people} × ${formatMoneyFactor(quantityTariff)}`;
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
