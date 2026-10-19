import { isTariffBaseMode, type TariffBaseMode, type TariffExceptionLine, type TariffSaleStat } from "@/lib/tariff-exceptions";

/** Розница, ИМ и безнал. Пустая строка и null — поле не заполнено. Ноль заполнен. */
export interface TariffChannels {
    main: string | null;
    im: string | null;
    b2b: string | null;
}

/** «Тариф за цену» и «тариф за долю». В базу не пишутся. */
export interface TariffServiceColumns {
    priceTariff: string | null;
    shareTariff: string | null;
}

/** Вариант расчёта на экране тарифов. В базу не пишется, сохранение идёт от среднего. */
export const TARIFF_REFERENCES = ["mean", "median", "trimmed", "priceAdjusted"] as const;

export type TariffReference = (typeof TARIFF_REFERENCES)[number];

export const DEFAULT_TARIFF_REFERENCE: TariffReference = "mean";

/** Доля крайних значений, которую усечённое среднее отбрасывает с каждого края. */
export const TRIMMED_MEAN_PROPORTION = 0.1;

/**
 * Веса на экране заданы процентами от 0 до 100 и в формуле становятся долей.
 * Опора территории считается только по значениям больше нуля.
 */
export interface TariffServiceContext {
    salesShareWeight: number;
    priceShareWeight: number;
    min: number | null;
    base: number | null;
    max: number | null;
    averagePrice: number | null;
    averageQuantity: number | null;
    /** Надбавка за малые продажи зависит от цены. По умолчанию выключено: действует расчёт от среднего. */
    adjustShareByPrice?: boolean;
}

export interface TariffRowDraft {
    code: string;
    automatic: boolean;
    baseMode: TariffBaseMode;
    main: string | null;
    im: string | null;
    b2b: string | null;
    /** Ставки исключения, уже лежащие в базе. null — исключения ещё нет. */
    stored: TariffChannels | null;
}

export interface TariffSaveRow {
    code: string;
    automatic: boolean;
    baseMode: TariffBaseMode;
    main: number;
    im: number;
    b2b: number;
}

export const DEFAULT_TARIFF_MODE: TariffBaseMode = "per_unit";

export const EMPTY_TARIFF_SAVE_MESSAGE = "Нельзя сохранить тарифы, пока хотя бы одно поле пустое";

const CODE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Среднее территории для делителя. Ноль и пустые значения в среднее не входят. */
export function territoryMean(values: Array<string | null>): number | null {
    return territoryReference(values, "mean");
}

/**
 * Опора тарифа за цену и тарифа за долю.
 * Медиана при чётном числе значений — среднее двух центральных.
 * Усечённое среднее отбрасывает по 10% с каждого края и усредняет остаток.
 * Поправка на цену опирается на то же среднее.
 */
export function territoryReference(values: Array<string | null>, reference: TariffReference): number | null {
    const numbers = values
        .map((value) => numericStat(value))
        .filter((value): value is number => value !== null && value > 0)
        .sort((left, right) => left - right);
    if (numbers.length === 0) {
        return null;
    }
    if (reference === "median") {
        const mid = Math.floor(numbers.length / 2);
        return numbers.length % 2 === 0 ? (numbers[mid - 1] + numbers[mid]) / 2 : numbers[mid];
    }
    if (reference === "trimmed") {
        const drop = Math.floor(TRIMMED_MEAN_PROPORTION * numbers.length);
        const kept = drop === 0 ? numbers : numbers.slice(drop, numbers.length - drop);
        if (kept.length === 0) {
            return null;
        }
        return kept.reduce((sum, value) => sum + value, 0) / kept.length;
    }
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

/**
 * Тариф за цену: средняя стоимость строки / опора цены территории × базовая премия × вес.
 * Тариф за долю: опора количества территории / количество строки × базовая премия × вес.
 * Поправка на цену уменьшает надбавку за малые продажи у дешёвого товара и не меняет её у товара не дешевле опоры.
 * Ниже минимальной премии × вес не опускается, выше максимальной × вес не поднимается.
 * Нет базы, границы, среднего или делителя — ячейка пустая, не ноль.
 */
export function calculateServiceTariffs(
    stat: Pick<TariffSaleStat, "avgPrice" | "quantity">,
    context?: TariffServiceContext | null,
): TariffServiceColumns {
    if (!context) {
        return { priceTariff: null, shareTariff: null };
    }
    const price = numericStat(stat.avgPrice);
    return {
        priceTariff: weightedPremium(price, context.averagePrice, context.priceShareWeight, context, "row"),
        shareTariff: sharePremium(price, numericStat(stat.quantity), context),
    };
}

/**
 * Тариф за количество — сумма тарифа за цену и тарифа за долю.
 * Тариф от цены на экране — эта сумма в процентах от средней стоимости строки.
 * В ставку записывается неотформатированная доля: 0,28% хранится как 0,0028.
 * ИМ и безнал всегда равны тарифу за количество.
 * Нет одного из слагаемых — ставки пустые, не нулевые.
 */
export function calculateAlgorithmTariffs(input: {
    stat: Pick<TariffSaleStat, "avgPrice" | "quantity">;
    mode: TariffBaseMode;
    service: TariffServiceColumns;
}): TariffChannels {
    const price = numericStat(input.service.priceTariff);
    const share = numericStat(input.service.shareTariff);
    if (price === null || share === null) {
        return { main: null, im: null, b2b: null };
    }
    const perUnit = String(Math.round(price + share));
    if (input.mode !== "percent") {
        return { main: perUnit, im: perUnit, b2b: perUnit };
    }
    const averagePrice = numericStat(input.stat.avgPrice);
    if (averagePrice === null || averagePrice === 0) {
        return { main: null, im: perUnit, b2b: perUnit };
    }
    const ratio = Math.round((Number(perUnit) / averagePrice) * 10_000) / 10_000;
    return { main: String(ratio), im: perUnit, b2b: perUnit };
}

export function periodTariffsEmpty(stats: TariffChannels[]): boolean {
    return stats.every((row) => !hasTariffValue(row.main) && !hasTariffValue(row.im) && !hasTariffValue(row.b2b));
}

/** Открытый месяц без сохранённых ставок сначала считается, и только потом его можно править. */
export function shouldCalculateBeforeEditing(stats: TariffChannels[], editable: boolean): boolean {
    return editable && stats.length > 0 && periodTariffsEmpty(stats);
}

/**
 * Галочка включена — алгоритм.
 * Галочка снята и исключение есть в базе — его ставки.
 * Галочки нет и исключения в базе нет — поля пустые.
 */
export function resolveTariffChannels(input: {
    automatic: boolean;
    stat: Pick<TariffSaleStat, "avgPrice" | "quantity">;
    mode: TariffBaseMode;
    storedException: TariffChannels | null;
    context?: TariffServiceContext | null;
}): TariffChannels {
    if (input.automatic) {
        const service = calculateServiceTariffs(input.stat, input.context);
        return calculateAlgorithmTariffs({ stat: input.stat, mode: input.mode, service });
    }
    if (!input.storedException) {
        return { main: null, im: null, b2b: null };
    }
    return {
        main: input.storedException.main,
        im: input.storedException.im,
        b2b: input.storedException.b2b,
    };
}

/** В исключения попадают ручные строки и строки со сменой вида расчёта. */
export function rowBecomesException(row: { automatic: boolean; baseMode: TariffBaseMode }): boolean {
    return !row.automatic || row.baseMode !== DEFAULT_TARIFF_MODE;
}

export function openPeriodRows(
    stats: TariffSaleStat[],
    exceptions: TariffExceptionLine[],
    editable: boolean,
    context?: TariffServiceContext | null,
): TariffRowDraft[] {
    const byCode = new Map(exceptions.map((line) => [line.code, line]));
    const run = shouldCalculateBeforeEditing(stats, editable);
    return stats.map((stat) => {
        const exception = byCode.get(stat.code) ?? null;
        const stored = exception ? { main: exception.main, im: exception.im, b2b: exception.b2b } : null;
        const automatic = exception ? exception.automatic : true;
        const baseMode = isTariffBaseMode(stat.baseMode) ? stat.baseMode : (exception?.baseMode ?? DEFAULT_TARIFF_MODE);
        const channels = editable && automatic
            ? resolveTariffChannels({ automatic: true, stat, mode: baseMode, storedException: stored, context })
            : run
                ? resolveTariffChannels({ automatic, stat, mode: baseMode, storedException: stored, context })
                : { main: stat.main, im: stat.im, b2b: stat.b2b };
        return { code: stat.code, automatic, baseMode, stored, ...channels };
    });
}

export function setRowAutomatic(row: TariffRowDraft, stat: TariffSaleStat, automatic: boolean, context?: TariffServiceContext | null): TariffRowDraft {
    if (automatic) {
        const service = calculateServiceTariffs(stat, context);
        return { ...row, automatic: true, ...calculateAlgorithmTariffs({ stat, mode: row.baseMode, service }) };
    }
    return { ...row, automatic: false };
}

export function setRowMode(row: TariffRowDraft, stat: TariffSaleStat, mode: TariffBaseMode, context?: TariffServiceContext | null): TariffRowDraft {
    const next = { ...row, baseMode: mode };
    if (!next.automatic) {
        return next;
    }
    const service = calculateServiceTariffs(stat, context);
    return { ...next, ...calculateAlgorithmTariffs({ stat, mode, service }) };
}

/** Ручной ввод снимает галочку и оставляет уже рассчитанные значения в остальных полях. */
export function setManualChannel(row: TariffRowDraft, channel: keyof TariffChannels, value: string | null): TariffRowDraft {
    return { ...row, automatic: false, [channel]: value };
}

export function tariffRowComplete(row: TariffChannels): boolean {
    return parseTariffRate(row.main) !== null && parseTariffRate(row.im) !== null && parseTariffRate(row.b2b) !== null;
}

export function parseTariffRate(value: string | null): number | null {
    if (value === null) {
        return null;
    }
    const raw = value.trim().replace(",", ".");
    if (raw === "" || !/^-?\d+(\.\d+)?$/.test(raw)) {
        return null;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > 1e12) {
        return null;
    }
    return parsed;
}

export function parseTariffSaveRows(value: unknown): TariffSaveRow[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Проверьте список тарифов" };
    }
    const rows: TariffSaveRow[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return { error: "Проверьте список тарифов" };
        }
        const record = item as Record<string, unknown>;
        if (typeof record.code !== "string" || !CODE_PATTERN.test(record.code)) {
            return { error: "У тарифа некорректный код" };
        }
        const code = record.code.toLowerCase();
        if (seen.has(code)) {
            return { error: "Один и тот же тариф указан дважды" };
        }
        seen.add(code);
        if (typeof record.automatic !== "boolean") {
            return { error: "Укажите, считается ли строка автоматически" };
        }
        if (!isTariffBaseMode(record.baseMode)) {
            return { error: "Выберите вид основного тарифа: процент от цены или за количество" };
        }
        const main = readRequiredRate(record.main, "Тариф розница");
        if (typeof main !== "number") {
            return main;
        }
        const im = readRequiredRate(record.im, "Тариф ИМ");
        if (typeof im !== "number") {
            return im;
        }
        const b2b = readRequiredRate(record.b2b, "Тариф Безнал");
        if (typeof b2b !== "number") {
            return b2b;
        }
        rows.push({ code, automatic: record.automatic, baseMode: record.baseMode, main, im, b2b });
    }
    return rows;
}

function readRequiredRate(value: unknown, label: string): number | { error: string } {
    if (value === null || value === undefined || value === "") {
        return { error: EMPTY_TARIFF_SAVE_MESSAGE };
    }
    const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(",", ".") : null;
    if (raw === null || raw === "" || !/^-?\d+(\.\d+)?$/.test(raw)) {
        return { error: `${label}: укажите число` };
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || Math.abs(parsed) > 1e12) {
        return { error: `${label}: недопустимое число` };
    }
    return parsed;
}

function hasTariffValue(value: string | null): boolean {
    return value !== null && value !== "";
}

function numericStat(value: string | null): number | null {
    if (value === null || value.trim() === "") {
        return null;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function weightedPremium(
    value: number | null,
    average: number | null,
    weightPercent: number,
    context: TariffServiceContext,
    ratio: "row" | "territory",
): string | null {
    if (value === null || average === null) {
        return null;
    }
    const denominator = ratio === "territory" ? value : average;
    if (denominator === 0) {
        return null;
    }
    const relation = ratio === "territory" ? average / value : value / average;
    const result = clampedPremium(relation, weightPercent, context);
    return result === null ? null : String(Math.round(result));
}

/**
 * Доля надбавки за малые продажи.
 * 0 — цена на уровне минимальной премии или ниже, 1 — цена не ниже опоры.
 */
function rarityBlend(price: number | null, context: TariffServiceContext): number {
    if (
        price === null
        || context.averagePrice === null
        || context.averagePrice === 0
        || context.min === null
        || context.base === null
        || context.base <= 0
    ) {
        return 1;
    }
    const priceRelation = price / context.averagePrice;
    const floorRelation = context.min / context.base;
    if (floorRelation >= 1) {
        return priceRelation >= 1 ? 1 : 0;
    }
    if (priceRelation <= floorRelation) {
        return 0;
    }
    if (priceRelation >= 1) {
        return 1;
    }
    return (priceRelation - floorRelation) / (1 - floorRelation);
}

function sharePremium(price: number | null, quantity: number | null, context: TariffServiceContext): string | null {
    if (quantity === null || context.averageQuantity === null || quantity === 0 || context.averageQuantity === 0) {
        return null;
    }
    const inverted = clampedPremium(context.averageQuantity / quantity, context.salesShareWeight, context);
    if (inverted === null) {
        return null;
    }
    if (!context.adjustShareByPrice) {
        return String(Math.round(inverted));
    }
    const direct = clampedPremium(quantity / context.averageQuantity, context.salesShareWeight, context);
    if (direct === null) {
        return null;
    }
    const excess = Math.max(0, inverted - direct);
    const result = inverted - excess * (1 - rarityBlend(price, context));
    if (!Number.isFinite(result)) {
        return null;
    }
    return String(Math.round(result));
}

function clampedPremium(relation: number, weightPercent: number, context: TariffServiceContext): number | null {
    if (context.min === null || context.base === null || context.max === null || !Number.isFinite(relation) || !Number.isFinite(weightPercent)) {
        return null;
    }
    const weight = weightPercent / 100;
    let result = relation * context.base * weight;
    const floor = context.min * weight;
    const ceiling = context.max * weight;
    if (result < floor) {
        result = floor;
    }
    if (result > ceiling) {
        result = ceiling;
    }
    if (!Number.isFinite(result)) {
        return null;
    }
    return result;
}
