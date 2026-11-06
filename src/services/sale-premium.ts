import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
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
    throw new SalePremiumError("Запросы премии ещё не записывают результат");
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
