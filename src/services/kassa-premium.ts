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

const KASSA_INDICATOR = "Кассовые операции";

export async function calculateKassaPremium(period: string, refreshSchedule = true, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = premiumAsOf(run);
    const selectSql = await kassaSelectSql();
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (refreshSchedule) {
            await replaceAuthorDays(query, period, asOf);
        }
        return writeOpenPremiumDays(query, period, KASSA_INDICATOR, [selectSql], { ...run, asOf });
    });
}

export async function readBranchKassaPremiumDays(period: string, branchId: string): Promise<{ id: string; day: string; amount: number }[]> {
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
          AND indicator.name = 'Кассовые операции'
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

export interface KassaPremiumLine {
    id: string;
    day: string;
    minutes: number;
    tariff: number;
    amount: number;
    employeeId?: string;
    employeeName?: string;
}

export interface KassaPremiumDetail {
    lines: KassaPremiumLine[];
    share?: number | null;
    members?: { id: string; name: string }[];
}

interface KassaDetailRow {
    day: string;
    minute: number | string;
    tariff: number | string;
    premium: number | string;
    employeeId?: string | null;
}

export async function readKassaPremiumDetail(
    access: AccessView,
    period: string,
    branchId: string,
    employeeId: string,
    activeFrom: string | null,
    activeUntil: string | null,
): Promise<KassaPremiumDetail | null> {
    if (!PERIOD.test(period) || !UUID.test(branchId) || !UUID.test(employeeId)) {
        return null;
    }
    const from = activeFrom && DAY.test(activeFrom) ? activeFrom : null;
    const until = activeUntil && DAY.test(activeUntil) ? activeUntil : from;
    if (!await canReadEmployeeDetail(access, period, branchId, employeeId)) {
        return null;
    }
    const { collectBrigadeLines } = await import("@/services/brigade-detail");
    const brigade = await collectBrigadeLines(period, branchId, employeeId, from, KASSA_INDICATOR, (input) => (
        loadKassaLines(period, branchId, input.employeeId, input.from, input.until, input.accrualId, input.authors)
    ));
    if (brigade) {
        return brigade;
    }
    const accrualId = await premiumAccrualId(period, branchId, employeeId, from, until, KASSA_INDICATOR);
    return { lines: await loadKassaLines(period, branchId, employeeId, from, until, accrualId, null) };
}

async function loadKassaLines(
    period: string,
    branchId: string,
    employeeId: string,
    from: string | null,
    until: string | null,
    accrualId: number | null,
    authors: string[] | null,
): Promise<KassaPremiumLine[]> {
    const sourceSql = await kassaSelectSql();
    const brigade = authors !== null && authors.length > 0;
    const { sqlForAuthors } = brigade ? await import("@/services/brigade-detail") : { sqlForAuthors: null };
    const selectSql = sqlForAuthors ? sqlForAuthors(sourceSql) : sourceSql;
    const rows = await db.queryWithTimeout<KassaDetailRow>(
        `
        SELECT to_char(line.document_date, 'DD.MM.YYYY') AS day,
               line.minute,
               (line.tariff * line.coefficient)::float8 AS tariff,
               line.premium,
               line.employee_uuid::text AS "employeeId"
        FROM (
${selectSql}
        ) line
        ORDER BY line.document_date DESC, line.minute DESC
        `,
        brigade
            ? [period, null, branchId, null, null, null, null, authors]
            : [period, employeeId, branchId, from, until, accrualId, null],
        DETAIL_STATEMENT_TIMEOUT_MS,
    );
    return rows.flatMap((row, index) => {
        const minutes = finiteNumber(row.minute);
        const tariff = finiteNumber(row.tariff);
        const amount = finiteNumber(row.premium);
        if (minutes === null || tariff === null || amount === null) {
            return [];
        }
        const personId = row.employeeId?.toLowerCase() ?? "";
        return [{
            id: `${personId}:${row.day}:${index}`,
            day: row.day,
            minutes,
            tariff,
            amount,
            ...(personId ? { employeeId: personId } : {}),
        }];
    });
}

async function kassaSelectSql(): Promise<string> {
    const parts = await readIndicatorScriptSql(KASSA_INDICATOR);
    if (parts.length === 0) {
        throw new SalePremiumError("Для кассы не задан скрипт расчёта");
    }
    return parts.join("\nUNION ALL\n");
}

function finiteNumber(value: number | string): number | null {
    const amount = typeof value === "number" ? value : Number(value);
    return Number.isFinite(amount) ? amount : null;
}
