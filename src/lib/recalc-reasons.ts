export type RecalcScopeLevel = "division" | "territory" | "branch";

const REASONS: Record<string, string> = {
    "raw.sale": "Загрузка продаж",
    "raw.hr_ktu": "Загрузка штатного расписания",
    "raw.kassa_oper": "Загрузка кассовых операций",
    "branch.roles": "Смена ролей",
    "branch.shared-roles": "Роли общей премии",
    tariffs: "Тарифы",
    coefficients: "Коэффициенты",
    manual: "Ручной запуск",
};

export function recalcReasonLabel(trigger: string, origin: "system" | "manual" | null): string {
    if (trigger && REASONS[trigger]) {
        return REASONS[trigger];
    }
    if (trigger) {
        return trigger;
    }
    if (origin === "manual") {
        return "Ручной запуск";
    }
    return "Причина не указана";
}

export function recalcReasonPhrase(trigger: string, origin: "system" | "manual" | null): string {
    const label = recalcReasonLabel(trigger, origin);
    return label.charAt(0).toLowerCase() + label.slice(1);
}

/** Причины, чья подпись содержит слово поиска. Короткие обрывки не раскрывают весь список. */
export function recalcTriggersMatching(token: string): string[] {
    const needle = token.toLocaleLowerCase("ru-RU");
    if (needle.length < 3) {
        return [];
    }
    return Object.entries(REASONS)
        .filter(([, label]) => label.toLocaleLowerCase("ru-RU").includes(needle))
        .map(([trigger]) => trigger);
}

export function quoteNames(names: string[]): string {
    if (names.length === 0) {
        return "";
    }
    if (names.length === 1) {
        return `«${names[0]}»`;
    }
    if (names.length === 2) {
        return `«${names[0]}» и «${names[1]}»`;
    }
    const head = names.slice(0, -1).map((name) => `«${name}»`).join(", ");
    return `${head} и «${names[names.length - 1]}»`;
}

export function formatScopeLabel(level: RecalcScopeLevel, names: string[]): string {
    if (level === "division") {
        return "Дивизион";
    }
    const quoted = quoteNames(names);
    if (level === "territory") {
        return quoted === "" ? "РРС" : `РРС ${quoted}`;
    }
    if (names.length > 1) {
        return `Филиалы ${quoted}`;
    }
    return quoted === "" ? "Филиал" : `Филиал ${quoted}`;
}
