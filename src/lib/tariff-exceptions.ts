import { isTariffAxis, type TariffAxis, type TariffBoundKey } from "@/lib/baskets";
import type { RrsEditPolicy } from "@/lib/rrs-edit-window";
import type { TariffReference, TariffServiceContext } from "@/lib/tariff-calculation";

export const TARIFF_BASE_MODES = [
    { code: "percent", title: "Процент от цены" },
    { code: "per_unit", title: "За количество" },
] as const;

export type TariffBaseMode = (typeof TARIFF_BASE_MODES)[number]["code"];

const CODE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TariffSaleStat {
    code: string;
    title: string;
    /** Ближайшая папка, parent_1. */
    parent: string | null;
    /** Папка уровнем выше, parent_2. */
    parent2: string | null;
    /** Верхняя папка, parent_3. */
    parent3: string | null;
    avgPrice: string | null;
    quantity: string | null;
    /** Сохранённый вид розницы. null — строка тарифа ещё не записана. */
    baseMode: TariffBaseMode | null;
    main: string | null;
    im: string | null;
    b2b: string | null;
}

export interface TariffExceptionLine {
    code: string;
    title: string;
    parent: string | null;
    baseMode: TariffBaseMode;
    automatic: boolean;
    main: string | null;
    im: string | null;
    b2b: string | null;
    inStats: boolean;
    fromPeriod: string;
}

export interface TariffExceptionConnection {
    versionId: number;
    versionNo: number;
    versionName: string;
    versionStatus: string;
    axis: TariffAxis | null;
}

export interface TariffExceptionWeights {
    title: string;
    salesShareWeight: number;
    priceShareWeight: number;
    /** Территории разрешено менять вес, либо расчёт открыт администратором. */
    editable: boolean;
    /** Территории разрешён выбор опоры, либо расчёт открыт администратором. */
    referenceSelectable: boolean;
}

export function parseTariffWeightOverride(value: unknown): { salesShareWeight: number; priceShareWeight: number } | null | { error: string } {
    if (value === undefined || value === null) {
        return null;
    }
    if (typeof value !== "object") {
        return { error: "Проверьте веса" };
    }
    const record = value as Record<string, unknown>;
    const sales = record.salesShareWeight;
    const price = record.priceShareWeight;
    if (!Number.isInteger(sales) || !Number.isInteger(price) || (sales as number) < 0 || (sales as number) > 100 || (price as number) < 0 || (price as number) > 100) {
        return { error: "Веса задаются целыми числами от 0 до 100" };
    }
    if ((sales as number) + (price as number) !== 100) {
        return { error: "Сумма весов должна быть равна 100" };
    }
    return { salesShareWeight: sales as number, priceShareWeight: price as number };
}

export interface TariffExceptionPage {
    territory: { uuid: string; code: string; name: string };
    period: string;
    appliedPeriod: string | null;
    savedPeriods: string[];
    editable: boolean;
    editPolicy: RrsEditPolicy;
    connection: TariffExceptionConnection | null;
    exceptions: TariffExceptionLine[];
    stats: TariffSaleStat[];
    otherAxis: TariffAxis | null;
    otherAxisTitles: string[];
    weights: TariffExceptionWeights | null;
    bounds: { key: TariffBoundKey; title: string; value: string | null }[];
    reference: TariffReference;
}

export interface TariffQuote {
    code: string;
    avgPrice: string | null;
    quantity: string | null;
}

export interface TariffExceptionReport {
    territory: { uuid: string; code: string; name: string };
    period: string;
    appliedPeriod: string | null;
    savedPeriods: string[];
    editable: boolean;
    axis: TariffAxis | null;
    rows: TariffExceptionReportRow[];
    directory: TariffCategoryFolder[];
    quotes: TariffQuote[];
    service: TariffServiceContext | null;
}

export interface CalculatedTariffRow {
    code: string;
    title: string;
    baseMode: TariffBaseMode;
    automatic: boolean;
    main: string | null;
    im: string | null;
    b2b: string | null;
    exception: boolean;
}

export interface TariffCategoryFolder {
    code: string;
    title: string;
    folders: string[];
}

export interface TariffExceptionReportRow {
    territoryUuid: string;
    territoryCode: string;
    territoryName: string;
    axis: TariffAxis;
    code: string;
    title: string;
    folders: string[];
    archived: boolean;
    baseMode: TariffBaseMode;
    automatic: boolean;
    main: string | null;
    im: string | null;
    b2b: string | null;
    fromPeriod: string;
}

export interface TariffSegmentMatch {
    code: string;
    title: string;
    parent: string | null;
    inStats: boolean;
}

export interface TariffExceptionInput {
    code: string;
    baseMode: TariffBaseMode;
    automatic: boolean;
    main: number | null;
    im: number | null;
    b2b: number | null;
}

export function isTariffBaseMode(value: unknown): value is TariffBaseMode {
    return value === "percent" || value === "per_unit";
}

export function tariffBaseModeTitle(mode: TariffBaseMode): string {
    return TARIFF_BASE_MODES.find((item) => item.code === mode)?.title ?? mode;
}

export function parseTariffExceptionItems(value: unknown): TariffExceptionInput[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Проверьте список исключений" };
    }
    const items: TariffExceptionInput[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return { error: "Проверьте список исключений" };
        }
        const record = item as Record<string, unknown>;
        if (typeof record.code !== "string" || !CODE_PATTERN.test(record.code)) {
            return { error: "У исключения некорректный код" };
        }
        const code = record.code.toLowerCase();
        if (seen.has(code)) {
            return { error: "Одно и то же исключение указано дважды" };
        }
        seen.add(code);
        if (!isTariffBaseMode(record.baseMode)) {
            return { error: "Выберите вид основного тарифа: процент от цены или за количество" };
        }
        const main = readOptionalRate(record.main, "Основной тариф");
        if (typeof main === "object" && main !== null) {
            return main;
        }
        const im = readOptionalRate(record.im, "ИМ");
        if (typeof im === "object" && im !== null) {
            return im;
        }
        const b2b = readOptionalRate(record.b2b, "B2B");
        if (typeof b2b === "object" && b2b !== null) {
            return b2b;
        }
        items.push({ code, baseMode: record.baseMode, automatic: record.automatic !== false, main, im, b2b });
    }
    return items;
}

function readOptionalRate(value: unknown, label: string): number | null | { error: string } {
    if (value === null || value === undefined || value === "") {
        return null;
    }
    const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(",", ".") : null;
    if (raw === null || raw === "") {
        return null;
    }
    if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        return { error: `${label}: укажите число` };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > 1e12) {
        return { error: `${label}: недопустимое число` };
    }
    return parsed;
}
