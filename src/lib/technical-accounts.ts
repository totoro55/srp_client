// Технические учётки, чья премия идёт в общую премию филиала.
// Филиал для них — филиал документа, не штатное расписание.

export const TECHNICAL_ACCOUNTS = [
    { id: "3a3ad3e1-532e-11ec-8f3f-00155d8ed20c", name: "Автокасса" },
    { id: "abcc0768-6243-11ee-9153-00155d8ed20b", name: "Автокасса с каталогом" },
    { id: "4ec5093b-5bc2-11e7-8779-00155d03330d", name: "Терминал самообслуживания" },
] as const;

export function technicalAccount(id: string | null | undefined): (typeof TECHNICAL_ACCOUNTS)[number] | null {
    if (!id) {
        return null;
    }
    const key = id.toLowerCase();
    return TECHNICAL_ACCOUNTS.find((account) => account.id === key) ?? null;
}
