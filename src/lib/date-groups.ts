export type DateGroupPrecision = "day" | "month" | "year";

export interface DateGroupMeta {
    key: string;
    label: string;
    precision: DateGroupPrecision;
}

const NEAR_DAYS = 7;

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBefore(date: Date, now: Date): number {
    return Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);
}

function capitalize(text: string): string {
    return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

export function dateGroupMeta(iso: string, now = new Date()): DateGroupMeta {
    const date = new Date(iso);
    const age = daysBefore(date, now);
    if (age >= 0 && age < NEAR_DAYS) {
        const label = age === 0
            ? "Сегодня"
            : age === 1
                ? "Вчера"
                : capitalize(date.toLocaleDateString("ru-RU", date.getFullYear() === now.getFullYear()
                    ? { day: "numeric", month: "long" }
                    : { day: "numeric", month: "long", year: "numeric" }));
        return {
            key: `day:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
            label,
            precision: "day",
        };
    }
    const yearAgo = startOfDay(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    if (startOfDay(date).getTime() < yearAgo.getTime()) {
        return { key: `year:${date.getFullYear()}`, label: String(date.getFullYear()), precision: "year" };
    }
    return {
        key: `month:${date.getFullYear()}-${date.getMonth()}`,
        label: capitalize(date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })),
        precision: "month",
    };
}

export function formatGroupedWhen(iso: string, precision: DateGroupPrecision): string {
    const date = new Date(iso);
    if (precision === "day") {
        return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    if (precision === "month") {
        return date.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleString("ru-RU", { day: "numeric", month: "short" });
}

export function groupByDate<T>(
    items: T[],
    getIso: (item: T) => string,
    now = new Date(),
): Array<DateGroupMeta & { items: T[] }> {
    const groups: Array<DateGroupMeta & { items: T[] }> = [];
    for (const item of items) {
        const meta = dateGroupMeta(getIso(item), now);
        const last = groups[groups.length - 1];
        if (last && last.key === meta.key) {
            last.items.push(item);
            continue;
        }
        groups.push({ ...meta, items: [item] });
    }
    return groups;
}
