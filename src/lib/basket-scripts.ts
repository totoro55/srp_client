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
    {
        id: "osnt.documents",
        title: "Документы ОСНТ",
        indicator: "ОСНТ",
        parameters: ["quantity"],
        file: "osnt-premium-v1.sql",
        summary: "Число документов operation умножается на ставку quantity и коэффициент филиала osnt_coef.",
    },
    {
        id: "warehouse.quantity-volume",
        title: "Количество и объём склада",
        indicator: "Складские операции",
        parameters: ["quantity", "volume"],
        file: "warehouse-premium-v1.sql",
        summary: "Ставка quantity умножается на количество, ставка volume — на объём. Обе умножаются на коэффициент филиала warehouse_coef.",
    },
    {
        id: "unloading.volume",
        title: "Объём разгрузки",
        indicator: "Разгрузка ТС",
        parameters: ["volume"],
        file: "unloading-premium-v1.sql",
        summary: "Доля объёма приёмки на участника умножается на ставку volume и коэффициент филиала unloading_coef.",
    },
    {
        id: "selection.quantity-volume",
        title: "Количество и объём набора",
        indicator: "Набор товара",
        parameters: ["quantity", "volume"],
        file: "product-selection-premium-v1.sql",
        summary: "Ставка quantity умножается на количество, ставка volume — на объём. Обе умножаются на коэффициент филиала selection_coef.",
    },
    {
        id: "display.quantity-volume",
        title: "Количество и объём выставления",
        indicator: "Выставление товара",
        parameters: ["quantity", "volume"],
        file: "display-premium-v1.sql",
        summary: "Итог зоны делится поровну между сотрудниками зоны с часами табеля. Ставка quantity умножается на долю количества, ставка volume — на долю объёма. Обе умножаются на коэффициент филиала display_coef. Зона без часов и выставление без зоны складываются в «Общую» дня.",
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
