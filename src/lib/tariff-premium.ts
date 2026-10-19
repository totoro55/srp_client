import type { TariffAxis } from "@/lib/baskets";
import type { RrsEditPolicy } from "@/lib/rrs-edit-window";
import type { TariffBaseMode, TariffSaleStat } from "@/lib/tariff-exceptions";

/** Выгрузка статистики покрывает три полных месяца. */
export const STAT_WINDOW_MONTHS = 3;

export const PREMIUM_GROUP_LEVELS = ["item", "near", "mid", "top"] as const;
export type PremiumGroupLevel = (typeof PREMIUM_GROUP_LEVELS)[number];

export const PREMIUM_MONTH_CHOICES = [1, 2, 3] as const;
export type PremiumMonthCount = (typeof PREMIUM_MONTH_CHOICES)[number];

export interface PremiumView {
    level: PremiumGroupLevel;
    months: PremiumMonthCount;
    /** Строки с меньшим числом штук за выбранные месяцы в аналитику не входят. */
    minQuantity: number;
}

export const DEFAULT_PREMIUM_VIEW: PremiumView = { level: "item", months: 1, minQuantity: 0 };

export function isPremiumGroupLevel(value: unknown): value is PremiumGroupLevel {
    return typeof value === "string" && PREMIUM_GROUP_LEVELS.some((level) => level === value);
}

export function isPremiumMonthCount(value: unknown): value is PremiumMonthCount {
    return value === 1 || value === 2 || value === 3;
}

export function premiumGroupTitle(level: PremiumGroupLevel, axis: TariffAxis): string {
    if (level === "item") {
        return axis === "product_kind" ? "По изделию" : "По категории";
    }
    if (level === "near") {
        return "По папке";
    }
    if (level === "mid") {
        return "По папке выше";
    }
    return "По корневой папке";
}

/** «месяц», «2 месяца», «3 месяца». */
export function premiumSpanTitle(months: PremiumMonthCount): string {
    return months === 1 ? "месяц" : `${months} месяца`;
}

export const PREMIUM_BAR_LIMIT = 10;
export const PREMIUM_PIE_LIMIT = 30;

export interface TariffPremiumRow {
    code: string;
    title: string;
    /** Папка на уровень выше строки. Для категории или изделия это ближайшая папка. */
    parent: string | null;
    parent2: string | null;
    parent3: string | null;
    avgPrice: number;
    /** Штуки за всё окно выгрузки, до деления на месяцы. */
    windowQuantity: number;
    /** Штуки за выбранное число месяцев. */
    monthlyQuantity: number;
    baseMode: TariffBaseMode | null;
    /** Сохранённая ставка розницы. Для тарифа от цены это доля: 0,28% хранится как 0,0028. */
    rate: number | null;
    /** В группе ставки различаются или сохранены не у всех строк. */
    mixedTariff: boolean;
    /** Премия за выбранное число месяцев, в рублях. null — тариф месяца не сохранён. */
    premium: number | null;
    /** Категории или изделия внутри папки. Есть только у строки группировки. */
    children?: TariffPremiumRow[];
}

export interface PremiumViewResult {
    rows: TariffPremiumRow[];
    pool: number | null;
    counted: number;
    withoutTariff: number;
    excluded: number;
}

export interface TariffPremiumPage {
    territory: { uuid: string; code: string; name: string };
    period: string;
    appliedPeriod: string | null;
    savedPeriods: string[];
    editPolicy: RrsEditPolicy;
    axis: TariffAxis | null;
    rows: TariffPremiumRow[];
    /** Сумма премий строк с сохранённым тарифом. null — таких строк нет. */
    pool: number | null;
    counted: number;
    withoutTariff: number;
}

export function monthlySalesPremium(input: {
    baseMode: TariffBaseMode | null;
    rate: number | null;
    avgPrice: number;
    /** Штуки за окно выгрузки. */
    quantity: number;
    months?: PremiumMonthCount;
}): number | null {
    if (!input.baseMode || input.rate === null) {
        return null;
    }
    const months = input.months ?? 1;
    const periodQuantity = input.quantity * months / STAT_WINDOW_MONTHS;
    const raw = input.baseMode === "percent"
        ? input.rate * input.avgPrice * periodQuantity
        : input.rate * periodQuantity;
    return roundMoney(raw);
}

export function applyPremiumView(rows: TariffPremiumRow[], view: PremiumView): PremiumViewResult {
    const minimum = Number.isFinite(view.minQuantity) && view.minQuantity > 0 ? view.minQuantity : 0;
    const visible = rows.filter((row) => periodQuantity(row, view.months) >= minimum);
    const prepared = view.level === "item"
        ? visible.map((row) => scaleRow(row, view.months))
        : groupRows(visible, view.level, view.months);
    return summarize(prepared, rows.length - visible.length);
}

export function buildTariffPremiumPage(input: {
    territory: TariffPremiumPage["territory"];
    period: string;
    appliedPeriod: string | null;
    savedPeriods: string[];
    editPolicy: RrsEditPolicy;
    axis: TariffAxis | null;
    stats: TariffSaleStat[];
}): TariffPremiumPage {
    const rows = input.stats.map((stat) => toPremiumRow(stat));
    const counted = rows.filter((row) => row.premium !== null);
    const pool = counted.length === 0
        ? null
        : roundMoney(counted.reduce((sum, row) => sum + (row.premium ?? 0), 0));
    return {
        territory: input.territory,
        period: input.period,
        appliedPeriod: input.appliedPeriod,
        savedPeriods: input.savedPeriods,
        editPolicy: input.editPolicy,
        axis: input.axis,
        rows,
        pool,
        counted: counted.length,
        withoutTariff: rows.length - counted.length,
    };
}

function toPremiumRow(stat: TariffSaleStat): TariffPremiumRow {
    const avgPrice = numberOrZero(stat.avgPrice);
    const quantity = numberOrZero(stat.quantity);
    const rate = stat.main === null || stat.main === "" ? null : Number(stat.main);
    const safeRate = rate !== null && Number.isFinite(rate) ? rate : null;
    return {
        code: stat.code,
        title: stat.title,
        parent: stat.parent,
        parent2: stat.parent2,
        parent3: stat.parent3,
        avgPrice,
        windowQuantity: quantity,
        monthlyQuantity: quantity / STAT_WINDOW_MONTHS,
        baseMode: stat.baseMode,
        rate: safeRate,
        mixedTariff: false,
        premium: monthlySalesPremium({
            baseMode: stat.baseMode,
            rate: safeRate,
            avgPrice,
            quantity,
        }),
    };
}

function scaleRow(row: TariffPremiumRow, months: PremiumMonthCount): TariffPremiumRow {
    return {
        ...row,
        monthlyQuantity: periodQuantity(row, months),
        premium: monthlySalesPremium({
            baseMode: row.baseMode,
            rate: row.rate,
            avgPrice: row.avgPrice,
            quantity: row.windowQuantity,
            months,
        }),
    };
}

function periodQuantity(row: TariffPremiumRow, months: PremiumMonthCount): number {
    return row.windowQuantity * months / STAT_WINDOW_MONTHS;
}

function groupRows(rows: TariffPremiumRow[], level: Exclude<PremiumGroupLevel, "item">, months: PremiumMonthCount): TariffPremiumRow[] {
    const groups = new Map<string, TariffPremiumRow[]>();
    for (const row of rows) {
        const name = folderName(row, level) ?? "";
        const bucket = groups.get(name);
        if (bucket) {
            bucket.push(row);
        } else {
            groups.set(name, [row]);
        }
    }
    return [...groups.entries()]
        .map(([name, leaves]) => aggregateGroup(name, leaves, level, months))
        .sort((left, right) => left.title.localeCompare(right.title, "ru"));
}

function aggregateGroup(
    name: string,
    leaves: TariffPremiumRow[],
    level: Exclude<PremiumGroupLevel, "item">,
    months: PremiumMonthCount,
): TariffPremiumRow {
    const windowQuantity = leaves.reduce((sum, row) => sum + row.windowQuantity, 0);
    const weightedPrice = leaves.reduce((sum, row) => sum + row.avgPrice * row.windowQuantity, 0);
    const avgPrice = windowQuantity > 0
        ? weightedPrice / windowQuantity
        : leaves.reduce((sum, row) => sum + row.avgPrice, 0) / leaves.length;
    const priced = leaves.filter((row) => row.baseMode !== null && row.rate !== null);
    const uniform = priced.length === leaves.length && priced.every((row) => row.baseMode === priced[0]?.baseMode && row.rate === priced[0]?.rate);
    const premiums = leaves.map((row) => monthlySalesPremium({
        baseMode: row.baseMode,
        rate: row.rate,
        avgPrice: row.avgPrice,
        quantity: row.windowQuantity,
        months,
    }));
    const known = premiums.filter((premium): premium is number => premium !== null);
    const children = leaves
        .map((row) => scaleRow(row, months))
        .sort((left, right) => (right.premium ?? -1) - (left.premium ?? -1) || left.title.localeCompare(right.title, "ru"));
    return {
        code: `group:${level}:${name}`,
        title: name === "" ? "Без папки" : name,
        parent: mostCommon(leaves.map((row) => upperFolder(row, level))),
        parent2: null,
        parent3: null,
        avgPrice,
        windowQuantity,
        monthlyQuantity: windowQuantity * months / STAT_WINDOW_MONTHS,
        baseMode: uniform ? priced[0]?.baseMode ?? null : null,
        rate: uniform ? priced[0]?.rate ?? null : null,
        mixedTariff: !uniform && priced.length > 0,
        premium: known.length === 0 ? null : roundMoney(known.reduce((sum, premium) => sum + premium, 0)),
        children,
    };
}

function folderName(row: TariffPremiumRow, level: Exclude<PremiumGroupLevel, "item">): string | null {
    if (level === "near") {
        return row.parent;
    }
    if (level === "mid") {
        return row.parent2;
    }
    return row.parent3;
}

function upperFolder(row: TariffPremiumRow, level: Exclude<PremiumGroupLevel, "item">): string | null {
    if (level === "near") {
        return row.parent2;
    }
    if (level === "mid") {
        return row.parent3;
    }
    return null;
}

function mostCommon(values: Array<string | null>): string | null {
    const counts = new Map<string, number>();
    for (const value of values) {
        if (!value) {
            continue;
        }
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [value, count] of counts) {
        if (count > bestCount || (count === bestCount && best !== null && value.localeCompare(best, "ru") < 0)) {
            best = value;
            bestCount = count;
        }
    }
    return best;
}

function summarize(rows: TariffPremiumRow[], excluded: number): PremiumViewResult {
    const counted = rows.filter((row) => row.premium !== null);
    const pool = counted.length === 0
        ? null
        : roundMoney(counted.reduce((sum, row) => sum + (row.premium ?? 0), 0));
    return {
        rows,
        pool,
        counted: counted.length,
        withoutTariff: rows.length - counted.length,
        excluded,
    };
}

function numberOrZero(value: string | null): number {
    if (value === null || value === "") {
        return 0;
    }
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface PremiumShareSlice {
    key: string;
    title: string;
    premium: number;
    share: number;
    count: number;
    grouped: boolean;
}

/** Первые `limit` строк по премии. Хвост, если он есть и задано имя, суммируется в одну долю. */
export function premiumShareSlices(
    rows: TariffPremiumRow[],
    pool: number | null,
    limit: number,
    otherTitle?: string,
): PremiumShareSlice[] {
    if (pool === null || pool <= 0 || limit <= 0) {
        return [];
    }
    const ranked = rows
        .filter((row): row is TariffPremiumRow & { premium: number } => row.premium !== null && row.premium > 0)
        .map((row) => ({
            key: row.code,
            title: row.title,
            premium: row.premium,
            share: row.premium / pool,
            count: 1,
            grouped: false,
        }))
        .sort((left, right) => right.premium - left.premium || left.title.localeCompare(right.title, "ru"));
    const major = ranked.slice(0, limit);
    const minor = ranked.slice(limit);
    if (!otherTitle || minor.length === 0) {
        return major;
    }
    const premium = roundMoney(minor.reduce((sum, row) => sum + row.premium, 0));
    return [
        ...major,
        {
            key: "other",
            title: otherTitle,
            premium,
            share: premium / pool,
            count: minor.length,
            grouped: true,
        },
    ];
}
