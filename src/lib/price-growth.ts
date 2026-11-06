export interface PriceGrowthAllowance {
    period: string;
    value: number;
    setAt: string;
    setBy: string;
}

const MONTH = /^(\d{4})-(\d{2})$/;

export function priceGrowthPeriod(value: string): string | null {
    const match = MONTH.exec(value.trim());
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) {
        return null;
    }
    return `${match[1]}-${match[2]}-01`;
}

export function priceGrowthValue(value: unknown): number | null {
    const text = (typeof value === "number"
        ? String(value)
        : typeof value === "string"
            ? value.trim().replace(/\s/g, "").replace(",", ".")
            : "").replace(/\.$/, "");
    if (!/^\d+(\.\d{1,2})?$/.test(text)) {
        return null;
    }
    const number = Number(text);
    if (!Number.isFinite(number) || number > 1_000_000_000) {
        return null;
    }
    return Math.round(number * 100) / 100;
}

export function formatPriceGrowthMonth(period: string): string {
    const [year, month] = period.split("-");
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    const label = new Intl.DateTimeFormat("ru-RU", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    }).format(date);
    return label.replace(" г.", "");
}

export function formatPriceGrowthValue(value: number): string {
    return new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}
