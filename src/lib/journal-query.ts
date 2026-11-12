/** Строка поиска журнала: пустая строка и пробелы не фильтруют. */
export function parseJournalQuery(value: string | null | undefined): string | null {
    if (!value) {
        return null;
    }
    const text = value.replace(/\s+/g, " ").trim().slice(0, 80);
    return text === "" ? null : text;
}

export function journalSearchTokens(query: string | null): string[] {
    if (!query) {
        return [];
    }
    return query.split(" ").filter((token) => token !== "").slice(0, 4);
}

export function escapeJournalLike(token: string): string {
    return token.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const JOURNAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Календарный день `YYYY-MM-DD`. Несуществующая дата не фильтрует. */
export function parseJournalDay(value: string | null | undefined): string | null {
    if (!value || !JOURNAL_DAY.test(value)) {
        return null;
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }
    return value;
}

export function parseJournalDateRange(
    from: string | null | undefined,
    to: string | null | undefined,
): { from: string | null; to: string | null } {
    let start = parseJournalDay(from);
    let end = parseJournalDay(to);
    if (start && end && start > end) {
        [start, end] = [end, start];
    }
    return { from: start, to: end };
}
