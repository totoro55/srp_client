import { parseDetailDate } from "./BonusDetailPager";

export interface DetailGroup<T> {
    id: string;
    title: string;
    amount: number;
    lines: T[];
}

export function groupPremiumLines<T extends { id: string; amount: number }>(
    lines: T[],
    mode: "category" | "document",
    identity: {
        categoryTitle: (line: T) => string;
        documentId: (line: T) => string;
        documentTitle: (line: T) => string;
    },
): Array<DetailGroup<T>> {
    if (!Array.isArray(lines)) {
        return [];
    }
    const sorted = [...lines].sort((left, right) => right.amount - left.amount || left.id.localeCompare(right.id));
    const groups = new Map<string, DetailGroup<T>>();
    for (const line of sorted) {
        const key = mode === "document" ? identity.documentId(line) : identity.categoryTitle(line);
        const current = groups.get(key);
        if (current) {
            current.lines.push(line);
            current.amount += line.amount;
            continue;
        }
        groups.set(key, {
            id: mode === "document" ? key : `category:${key}`,
            title: mode === "document" ? identity.documentTitle(line) : identity.categoryTitle(line),
            amount: line.amount,
            lines: [line],
        });
    }
    return [...groups.values()].sort((left, right) => {
        const value = mode === "document"
            ? parseDetailDate(right.title) - parseDetailDate(left.title)
            : right.amount - left.amount;
        return value || left.id.localeCompare(right.id, "ru");
    });
}
