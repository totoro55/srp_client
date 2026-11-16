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

export const UNLOADING_INDICATOR = "Разгрузка ТС";

export async function calculateUnloadingPremium(period: string, refreshSchedule = true, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = premiumAsOf(run);
    const selectSql = await unloadingSelectSql();
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (refreshSchedule) {
            await replaceAuthorDays(query, period, asOf);
        }
        return writeOpenPremiumDays(query, period, UNLOADING_INDICATOR, [selectSql], { ...run, asOf });
    });
}

export async function readBranchUnloadingPremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
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
          AND indicator.name = 'Разгрузка ТС'
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

export interface UnloadingPremiumLine {
    id: string;
    day: string;
    participants: number;
    volume: number;
    calculation: string;
    amount: number;
}

export interface UnloadingPremiumDetail {
    lines: UnloadingPremiumLine[];
}

interface UnloadingDetailRow {
    day: string;
    participants: number | string;
    totalVolume: number | string;
    shareVolume: number | string;
    tariff: number | string;
    premium: number | string;
}

export async function readUnloadingPremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
): Promise<UnloadingPremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await canReadEmployeeDetail(access, period, branchId, employeeId)) {
        return null;
    }
    const accrualId = await premiumAccrualId(period, branchId, employeeId, from, until, UNLOADING_INDICATOR);
    const selectSql = await unloadingSelectSql();
    const rows = await db.queryWithTimeout<UnloadingDetailRow>(
        `
        SELECT to_char(line.document_date, 'DD.MM.YYYY') AS day,
               line.participants,
               line.total_volume AS "totalVolume",
               line.share_volume AS "shareVolume",
               (line.tariff * line.coefficient)::float8 AS tariff,
               line.premium
        FROM (
${selectSql}
        ) line
        ORDER BY line.document_date DESC
        `,
        [period, employeeId, branchId, from, until, accrualId, null],
        DETAIL_STATEMENT_TIMEOUT_MS,
    );
    return {
        lines: rows.flatMap((row, index) => {
            const participants = finiteNumber(row.participants);
            const totalVolume = finiteNumber(row.totalVolume);
            const tariff = finiteNumber(row.tariff);
            const amount = finiteNumber(row.premium);
            if (participants === null || totalVolume === null || tariff === null || amount === null) {
                return [];
            }
            return [{
                id: `${row.day}:${index}`,
                day: row.day,
                participants,
                volume: totalVolume,
                calculation: `${formatVolume(totalVolume)} м³ / ${formatCount(participants)} × ${formatCount(tariff)} ₽`,
                amount,
            }];
        }),
    };
}

async function unloadingSelectSql(): Promise<string> {
    const parts = await readIndicatorScriptSql(UNLOADING_INDICATOR);
    if (parts.length === 0) {
        throw new SalePremiumError("Для разгрузки ТС не задан скрипт расчёта");
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
