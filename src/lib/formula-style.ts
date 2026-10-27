import { newsColor, newsFontSize, NEWS_FONT_SIZE_MAX, NEWS_FONT_SIZE_MIN } from "@/lib/news-format";

export const FORMULA_FONT_DEFAULT = 14;
export const FORMULA_GAP_DEFAULT = 8;
export const FORMULA_GAP_MIN = 0;
export const FORMULA_GAP_MAX = 32;
export const FORMULA_GAP_STEP = 2;

export function formulaFontSize(value: unknown): number {
    if (typeof value === "number" && Number.isInteger(value) && value >= NEWS_FONT_SIZE_MIN && value <= NEWS_FONT_SIZE_MAX) {
        return value;
    }
    const parsed = newsFontSize(value);
    if (!parsed) {
        return FORMULA_FONT_DEFAULT;
    }
    return Number.parseInt(parsed, 10);
}

export function formulaGap(value: unknown): number {
    if (value === undefined || value === null || value === "") {
        return FORMULA_GAP_DEFAULT;
    }
    const number = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(number) || number < FORMULA_GAP_MIN || number > FORMULA_GAP_MAX) {
        return FORMULA_GAP_DEFAULT;
    }
    return number;
}

export function formulaColor(value: unknown): string | null {
    return newsColor(value) ?? null;
}

export function storedFormulaGap(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const number = typeof value === "number" ? value : Number.parseInt(String(value), 10);
    if (!Number.isInteger(number) || number < FORMULA_GAP_MIN || number > FORMULA_GAP_MAX) {
        return undefined;
    }
    return number;
}
