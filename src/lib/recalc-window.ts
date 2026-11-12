export type StaffLockReason = "dismissal" | "transfer" | "title";

export interface RecalcWindow {
    period: string;
    from: string;
    until: string;
    dismissal: boolean;
    transfer: boolean;
    title: boolean;
}

const MONTH = /^\d{4}-\d{2}-01$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long" });

export function monthLastDay(period: string): string {
    const [year, month] = period.slice(0, 7).split("-").map(Number);
    const date = new Date(Date.UTC(year, month, 0));
    return date.toISOString().slice(0, 10);
}

export function wholeMonth(input: Pick<RecalcWindow, "period" | "from" | "until">): boolean {
    return input.from === input.period && input.until === monthLastDay(input.period);
}

export function protectReasons(input: Pick<RecalcWindow, "dismissal" | "transfer" | "title">): StaffLockReason[] {
    const reasons: StaffLockReason[] = [];
    if (input.dismissal) {
        reasons.push("dismissal");
    }
    if (input.transfer) {
        reasons.push("transfer");
    }
    if (input.title) {
        reasons.push("title");
    }
    return reasons;
}

export function recalcWindowError(input: RecalcWindow): string | null {
    if (!MONTH.test(input.period) || !DAY.test(input.from) || !DAY.test(input.until)) {
        return "Укажите даты внутри месяца";
    }
    const end = monthLastDay(input.period);
    if (input.from < input.period || input.until > end || input.from > input.until) {
        return "Даты должны быть внутри выбранного месяца";
    }
    return null;
}

export function formatRecalcConditions(input: RecalcWindow): string {
    const start = new Date(`${input.from}T00:00:00`);
    const end = new Date(`${input.until}T00:00:00`);
    const range = wholeMonth(input)
        ? `Весь ${monthFormat.format(new Date(`${input.period}T00:00:00`))}`
        : input.from === input.until
            ? dayFormat.format(start)
            : `${start.getDate()}–${dayFormat.format(end)}`;
    const kept = named(input, true);
    const opened = named(input, false);
    return `${[range, sentence(kept, "не пересчитывается", "не пересчитываются"), sentence(opened, "пересчитывается", "пересчитываются")].filter((part) => part !== "").join(". ")}.`;
}

function named(input: Pick<RecalcWindow, "dismissal" | "transfer" | "title">, protect: boolean): string[] {
    return [
        input.dismissal === protect ? "увольнение" : null,
        input.transfer === protect ? "перевод" : null,
        input.title === protect ? "смена должности" : null,
    ].filter((item): item is string => item !== null);
}

function sentence(items: string[], one: string, many: string): string {
    if (items.length === 0) {
        return "";
    }
    const label = items.length === 1
        ? capitalize(items[0])
        : items.length === 2
            ? `${capitalize(items[0])} и ${items[1]}`
            : `${capitalize(items[0])}, ${items[1]} и ${items[2]}`;
    return `${label} ${items.length === 1 ? one : many}`;
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
