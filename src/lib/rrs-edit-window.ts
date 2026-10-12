export const RRS_EDIT_CUTOFF_MIN = 1;
export const RRS_EDIT_CUTOFF_MAX = 28;
export const DEFAULT_RRS_EDIT_CUTOFF_DAY = 5;

export interface RrsEditPolicy {
    cutoffDay: number;
    earliestMonth: string;
    currentMonth: string;
    previousMonth: string;
    nextMonth: string;
}

function monthKey(year: number, monthIndex: number): string {
    const date = new Date(year, monthIndex, 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${month}`;
}

export function buildRrsEditPolicy(cutoffDay: number, now = new Date()): RrsEditPolicy {
    const day = Math.min(RRS_EDIT_CUTOFF_MAX, Math.max(RRS_EDIT_CUTOFF_MIN, cutoffDay));
    const currentMonth = monthKey(now.getFullYear(), now.getMonth());
    return {
        cutoffDay: day,
        earliestMonth: now.getDate() <= day ? monthKey(now.getFullYear(), now.getMonth() - 1) : currentMonth,
        currentMonth,
        previousMonth: monthKey(now.getFullYear(), now.getMonth() - 1),
        nextMonth: monthKey(now.getFullYear(), now.getMonth() + 1),
    };
}

export function monthIsOpen(month: string, policy: RrsEditPolicy): boolean {
    return month >= policy.earliestMonth;
}

export function versionChangeOpen(month: string, policy: RrsEditPolicy): boolean {
    return month >= policy.nextMonth;
}

export function closedPeriodMessage(policy: RrsEditPolicy): string {
    return `Этот месяц закрыт для правки. Предыдущий месяц можно выбрать до ${policy.cutoffDay}-го числа включительно.`;
}

export function versionLockedMessage(basketName: string): string {
    return `Версию корзины «${basketName}» в текущем и предыдущем месяце менять нельзя. Смена версии доступна со следующего месяца.`;
}
