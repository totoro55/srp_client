import type { RecalcScopeLevel } from "@/lib/recalc-reasons";

const MINUTE = 60_000;

/** Автозагрузка и полный пересчёт дивизиона. */
export const DIVISION_RECALC_TIMEOUT_MS = 60 * MINUTE;
/** Пересчёт одной РРС. */
export const TERRITORY_RECALC_TIMEOUT_MS = 15 * MINUTE;
/** Пересчёт филиала или одной корзины. */
export const BRANCH_RECALC_TIMEOUT_MS = 10 * MINUTE;

export function recalcTimeoutMs(
    scopeLevel: RecalcScopeLevel,
    options?: { singleBasket?: boolean },
): number {
    if (options?.singleBasket || scopeLevel === "branch") {
        return BRANCH_RECALC_TIMEOUT_MS;
    }
    if (scopeLevel === "territory") {
        return TERRITORY_RECALC_TIMEOUT_MS;
    }
    return DIVISION_RECALC_TIMEOUT_MS;
}

export function statementTimeoutSql(timeoutMs: number): string {
    const timeout = Math.trunc(timeoutMs);
    if (!Number.isInteger(timeout) || timeout < 1) {
        throw new Error("Некорректный таймаут пересчёта");
    }
    return `SET LOCAL statement_timeout = ${timeout}`;
}
