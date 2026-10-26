export const NEWS_TEXT_COLORS = [
    { label: "Чёрный", value: "#111827" },
    { label: "Серый", value: "#6b7280" },
    { label: "Красный", value: "#dc2626" },
    { label: "Оранжевый", value: "#ea580c" },
    { label: "Зелёный", value: "#16a34a" },
    { label: "Синий", value: "#2563eb" },
    { label: "Фиолетовый", value: "#7c3aed" },
] as const;

export const NEWS_HIGHLIGHT_COLORS = [
    { label: "Жёлтый", value: "#fef08a" },
    { label: "Зелёный", value: "#bbf7d0" },
    { label: "Синий", value: "#bfdbfe" },
    { label: "Розовый", value: "#fecdd3" },
    { label: "Оранжевый", value: "#fed7aa" },
] as const;

export const NEWS_FILL_COLORS = [
    { label: "Серый", value: "#f3f4f6" },
    { label: "Красный", value: "#fee2e2" },
    { label: "Оранжевый", value: "#ffedd5" },
    { label: "Жёлтый", value: "#fef9c3" },
    { label: "Зелёный", value: "#dcfce7" },
    { label: "Синий", value: "#dbeafe" },
    { label: "Фиолетовый", value: "#ede9fe" },
] as const;

export const NEWS_FONT_SIZES = [
    { label: "12 px", value: "12px" },
    { label: "14 px", value: "14px" },
    { label: "18 px", value: "18px" },
    { label: "20 px", value: "20px" },
    { label: "24 px", value: "24px" },
    { label: "32 px", value: "32px" },
] as const;

const COLORS = new Set<string>([
    ...NEWS_TEXT_COLORS.map((item) => item.value),
    ...NEWS_HIGHLIGHT_COLORS.map((item) => item.value),
    ...NEWS_FILL_COLORS.map((item) => item.value),
]);

const FONT_SIZES = new Set<string>(NEWS_FONT_SIZES.map((item) => item.value));

export function newsColor(value: unknown): string | undefined {
    return typeof value === "string" && COLORS.has(value.toLowerCase()) ? value.toLowerCase() : undefined;
}

export function newsFontSize(value: unknown): string | undefined {
    return typeof value === "string" && FONT_SIZES.has(value) ? value : undefined;
}

export const NEWS_BORDER_COLORS = [
    { label: "Чёрный", value: "#111827", token: "ink" },
    { label: "Серый", value: "#6b7280", token: "slate" },
    { label: "Красный", value: "#dc2626", token: "red" },
    { label: "Оранжевый", value: "#ea580c", token: "orange" },
    { label: "Зелёный", value: "#16a34a", token: "green" },
    { label: "Синий", value: "#2563eb", token: "blue" },
    { label: "Фиолетовый", value: "#7c3aed", token: "violet" },
] as const;

export const NEWS_BORDER_WIDTHS = [
    { label: "Тонкая", value: 1, token: "thin" },
    { label: "Обычная", value: 2, token: "regular" },
    { label: "Жирная", value: 4, token: "thick" },
] as const;

export function newsBorderWidth(value: unknown): (typeof NEWS_BORDER_WIDTHS)[number]["value"] | undefined {
    const number = typeof value === "number"
        ? value
        : typeof value === "string"
            ? Number.parseInt(value, 10)
            : Number.NaN;
    return NEWS_BORDER_WIDTHS.find((item) => item.value === number)?.value;
}

export function newsBorderToken(value: unknown): (typeof NEWS_BORDER_COLORS)[number]["token"] | undefined {
    const color = newsColor(value);
    return NEWS_BORDER_COLORS.find((item) => item.value === color)?.token;
}

export function newsBorderWidthToken(value: unknown): (typeof NEWS_BORDER_WIDTHS)[number]["token"] | undefined {
    const width = newsBorderWidth(value);
    return NEWS_BORDER_WIDTHS.find((item) => item.value === width)?.token;
}

export function newsBorderColorFromAttribute(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    return NEWS_BORDER_COLORS.find((item) => item.token === value)?.value ?? newsColor(value);
}

export function newsBorderWidthFromAttribute(value: unknown): (typeof NEWS_BORDER_WIDTHS)[number]["value"] | undefined {
    if (typeof value !== "string" && typeof value !== "number") {
        return undefined;
    }
    return NEWS_BORDER_WIDTHS.find((item) => item.token === value)?.value ?? newsBorderWidth(value);
}

export function newsImageAlign(value: unknown): "center" | "right" | undefined {
    return value === "center" || value === "right" ? value : undefined;
}
