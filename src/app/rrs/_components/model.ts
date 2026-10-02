import type { BasketParameter } from "@/lib/baskets";
import type { RrsBasketOffer, RrsConnectionSlice, RrsVersionOffer } from "@/lib/rrs";

export interface BasketForm {
    basketId: number;
    connected: boolean;
    versionId: number | null;
    values: Record<string, string>;
}

const MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(period: string): string {
    const [year, month] = period.split("-");
    return `${MONTHS_GENITIVE[Number(month) - 1]} ${year}`;
}

export function preferredVersion(basket: RrsBasketOffer, versionId: number | null): RrsVersionOffer | undefined {
    return basket.versions.find((version) => version.id === versionId)
        ?? [...basket.versions].reverse().find((version) => version.status === "working")
        ?? basket.versions[basket.versions.length - 1];
}

export function valuesFor(version: RrsVersionOffer | undefined, connection: RrsConnectionSlice | undefined): Record<string, string> {
    const values: Record<string, string> = {};
    if (!version) {
        return values;
    }
    for (const parameter of version.parameters) {
        const stored = connection?.versionId === version.id ? connection.values?.[parameter.key] : undefined;
        values[parameter.key] = stored ?? "";
    }
    return values;
}

export function buildForms(baskets: RrsBasketOffer[], connections: RrsConnectionSlice[]): BasketForm[] {
    return baskets.map((basket) => {
        const connection = connections.find((item) => item.basketId === basket.id);
        const wasConnected = connection?.versionId != null;
        const offered = basket.versions.some((item) => item.id === connection?.versionId);
        const version = preferredVersion(basket, offered ? connection?.versionId ?? null : null);
        return {
            basketId: basket.id,
            connected: basket.mandatory || wasConnected,
            versionId: version?.id ?? null,
            values: valuesFor(offered ? version : undefined, offered ? connection : undefined),
        };
    });
}

export function fieldMissing(_parameter: BasketParameter, value: string | undefined): boolean {
    return (value ?? "").trim().length === 0;
}

export function formBlocked(baskets: RrsBasketOffer[], forms: BasketForm[]): boolean {
    return forms.some((form) => {
        if (!form.connected) {
            return false;
        }
        const basket = baskets.find((item) => item.id === form.basketId);
        const version = basket?.versions.find((item) => item.id === form.versionId);
        if (!version) {
            return true;
        }
        return version.parameters.some((parameter) => fieldMissing(parameter, form.values[parameter.key]));
    });
}

export const selectClassName = "h-9 w-full rounded-md border bg-background px-3 text-sm";
