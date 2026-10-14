import type { BasketCoefficient } from "@/lib/baskets";

export function coefficientValueIssue(raw: string, coefficient: BasketCoefficient, partial = false): string | null {
    const trimmed = raw.trim();
    if (trimmed === "") {
        return partial ? null : "Укажите число";
    }
    const complete = /^-?\d+([.,]\d+)?$/.test(trimmed);
    const incomplete = /^-?\d*[.,]?$/.test(trimmed);
    if (!complete) {
        if (partial && incomplete) {
            return null;
        }
        return `Укажите число. ${coefficientRangeLabel(coefficient)}`;
    }
    const value = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(value)) {
        return "Укажите число";
    }
    if (coefficient.integer && !Number.isInteger(value)) {
        return "Допускается только целое число";
    }
    if (coefficient.min !== null && value < coefficient.min) {
        return coefficientRangeLabel(coefficient);
    }
    if (coefficient.max !== null && value > coefficient.max) {
        return coefficientRangeLabel(coefficient);
    }
    return null;
}

export function coefficientRangeLabel(coefficient: BasketCoefficient): string {
    const range = coefficient.min !== null && coefficient.max !== null
        ? `допустимый диапазон от ${coefficient.min} до ${coefficient.max}`
        : coefficient.min !== null
            ? `значение не менее ${coefficient.min}`
            : coefficient.max !== null
                ? `значение не более ${coefficient.max}`
                : "диапазон не ограничен";
    const text = coefficient.integer ? `${range}, допускается только целое число` : range;
    return text.charAt(0).toUpperCase() + text.slice(1);
}
