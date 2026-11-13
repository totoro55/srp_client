import type { BasketParameter } from "@/lib/baskets";

export interface BasketScript {
    id: string;
    title: string;
    /** Показатель корзины, для которой скрипт можно выбрать. */
    indicator: string;
    /** Коды числовых параметров. Скрипт читает их из таблицы подключённой версии. */
    parameters: readonly string[];
    /** Файл запроса в src/services. Строки результата совпадают у скриптов одного показателя. */
    file: string;
    summary: string;
}

export const BASKET_SCRIPTS: readonly BasketScript[] = [
    {
        id: "release.quantity-volume",
        title: "Количество и объём",
        indicator: "Выдача товара",
        parameters: ["quantity", "volume"],
        file: "release-premium-v1.sql",
        summary: "Ставка quantity умножается на количество, ставка volume — на объём. Обе умножаются на коэффициент филиала release_coef.",
    },
    {
        id: "kassa.minutes",
        title: "Минуты кассы",
        indicator: "Кассовые операции",
        parameters: ["kassa_oper"],
        file: "kassa-premium-v1.sql",
        summary: "Минуты операции умножаются на ставку kassa_oper и коэффициент филиала kassa_coef.",
    },
];

export function basketScriptsFor(indicator: string): BasketScript[] {
    return BASKET_SCRIPTS.filter((script) => script.indicator === indicator);
}

export function basketScriptById(id: string): BasketScript | null {
    return BASKET_SCRIPTS.find((script) => script.id === id) ?? null;
}

export function basketScriptIssue(indicator: string, scriptId: string | null, parameters: BasketParameter[]): string | null {
    if (scriptId === null) {
        return null;
    }
    const script = basketScriptById(scriptId);
    if (!script || script.indicator !== indicator) {
        return "Выберите скрипт этой корзины";
    }
    const missing = script.parameters.filter((key) => {
        const parameter = parameters.find((item) => item.key === key);
        return !parameter || parameter.kind !== "number";
    });
    if (missing.length === 0) {
        return null;
    }
    return `Для скрипта «${script.title}» нужны числовые параметры ${missing.join(", ")}.`;
}
