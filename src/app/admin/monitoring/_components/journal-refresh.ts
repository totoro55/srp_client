export const JOURNAL_REFRESH_KEY = "srp-journal-refresh-seconds";

export const JOURNAL_REFRESH_INTERVALS = [
    { id: "0", label: "Не обновлять" },
    { id: "5", label: "Каждые 5 секунд" },
    { id: "15", label: "Каждые 15 секунд" },
    { id: "30", label: "Каждые 30 секунд" },
    { id: "60", label: "Каждую минуту" },
] as const;

export type JournalRefreshId = (typeof JOURNAL_REFRESH_INTERVALS)[number]["id"];

export function readJournalRefresh(): JournalRefreshId {
    if (typeof window === "undefined") {
        return "5";
    }
    const stored = window.localStorage.getItem(JOURNAL_REFRESH_KEY);
    if (JOURNAL_REFRESH_INTERVALS.some((item) => item.id === stored)) {
        return stored as JournalRefreshId;
    }
    return "5";
}

export function writeJournalRefresh(id: JournalRefreshId) {
    window.localStorage.setItem(JOURNAL_REFRESH_KEY, id);
}
