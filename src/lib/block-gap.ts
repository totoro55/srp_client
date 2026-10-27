export const BLOCK_GAP_MIN = 0;
export const BLOCK_GAP_MAX = 64;
export const BLOCK_GAP_STEP = 4;
export const BLOCK_GAP_DEFAULT = 8;

const ROOMY = new Set(["image", "blockquote", "table", "codeBlock", "details"]);

function readNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== "string") {
        return undefined;
    }
    const match = /^(-?\d+(?:\.\d+)?)(?:px)?$/.exec(value.trim());
    if (!match) {
        return undefined;
    }
    const number = Number(match[1]);
    return Number.isFinite(number) ? number : undefined;
}

export function blockGapDefault(type: string): number {
    if (ROOMY.has(type)) {
        return 12;
    }
    if (type === "horizontalRule") {
        return 16;
    }
    return BLOCK_GAP_DEFAULT;
}

export function clampBlockGap(value: number): number {
    const rounded = Math.round(value / BLOCK_GAP_STEP) * BLOCK_GAP_STEP;
    return Math.min(BLOCK_GAP_MAX, Math.max(BLOCK_GAP_MIN, rounded));
}

export function storedBlockGap(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const number = readNumber(value);
    if (number === undefined) {
        return undefined;
    }
    const rounded = clampBlockGap(number);
    if (rounded !== number && Math.abs(rounded - number) > BLOCK_GAP_STEP / 2) {
        return undefined;
    }
    return rounded;
}

export function blockGap(value: unknown, fallback: number): number {
    return storedBlockGap(value) ?? fallback;
}

export function writeBlockGap(element: HTMLElement, value: unknown) {
    const stored = storedBlockGap(value);
    element.style.marginBottom = stored === undefined ? "" : `${stored}px`;
}
