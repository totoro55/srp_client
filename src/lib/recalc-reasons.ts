export type RecalcScopeLevel = "division" | "territory" | "branch";

const REASONS: Record<string, string> = {
    "raw.sale": "Загрузка продаж",
    "raw.hr_ktu": "Загрузка штатного расписания",
    "raw.kassa_oper": "Загрузка кассовых операций",
    "branch.roles": "Смена ролей",
    "branch.shared-roles": "Роли общей премии",
    "branch.brigades": "Сохранение бригад",
    tariffs: "Тарифы",
    coefficients: "Коэффициенты",
    "rrs.wizard": "Настройка корзин",
    "rrs.connections": "Подключение корзин",
    "rrs.motivation": "Участие филиалов",
    "stm-brands": "Бренды СТМ",
    manual: "Ручной запуск",
    schedule: "Автозагрузка",
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

/** Имена в кавычках «…» из подписи охвата. */
export function parseQuotedNames(label: string): string[] {
    const names: string[] = [];
    const pattern = /«([^»]*)»/g;
    let match = pattern.exec(label);
    while (match) {
        names.push(match[1]);
        match = pattern.exec(label);
    }
    return names;
}

/**
 * Длинный список филиалов сжимает до «Филиалы «Первый» и ещё N».
 * Хвост после списка (причина запуска) сохраняет.
 * Одного или двух имён не трогает.
 */
export function compactBranchScopeLabel(label: string): string | null {
    if (!label.startsWith("Филиалы ")) {
        return null;
    }
    const names = parseQuotedNames(label);
    if (names.length <= 2) {
        return null;
    }
    const lastQuote = label.lastIndexOf("»");
    if (lastQuote < 0) {
        return null;
    }
    const suffix = label.slice(lastQuote + 1);
    return `Филиалы «${names[0]}» и ещё ${names.length - 1}${suffix}`;
}
