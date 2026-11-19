import type { RecalcScopeLevel } from "@/lib/recalc-reasons";

const MINUTE = 60_000;

/** Автозагрузка и пересчёт дивизиона. Лимит одного запроса корзины. */
export const DIVISION_RECALC_TIMEOUT_MS = 6 * MINUTE;
/** Пересчёт одной РРС и списка филиалов. */
export const TERRITORY_RECALC_TIMEOUT_MS = 4 * MINUTE;
/** Пересчёт одного филиала. */
export const BRANCH_RECALC_TIMEOUT_MS = 2 * MINUTE;

export function recalcTimeoutMs(scopeLevel: RecalcScopeLevel, branchCount = 1): number {
    if (scopeLevel === "branch") {
        return branchCount > 1 ? TERRITORY_RECALC_TIMEOUT_MS : BRANCH_RECALC_TIMEOUT_MS;
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
