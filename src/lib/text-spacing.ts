export const TEXT_LINE_MIN = 1;
export const TEXT_LINE_MAX = 3;
export const TEXT_LINE_STEP = 0.1;
export const TEXT_LINE_DEFAULT = 1.5;

export const TEXT_TRACKING_MIN = -2;
export const TEXT_TRACKING_MAX = 16;
export const TEXT_TRACKING_STEP = 1;
export const TEXT_TRACKING_DEFAULT = 0;

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

function roundTo(value: number, step: number): number {
    const factor = Math.round(1 / step);
    return Math.round(value * factor) / factor;
}

export function textLineHeight(value: unknown): number {
    const number = readNumber(value);
    if (number === undefined) {
        return TEXT_LINE_DEFAULT;
    }
    const rounded = roundTo(number, TEXT_LINE_STEP);
    if (rounded < TEXT_LINE_MIN || rounded > TEXT_LINE_MAX) {
        return TEXT_LINE_DEFAULT;
    }
    return rounded;
}

export function storedTextLineHeight(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const number = readNumber(value);
    if (number === undefined) {
        return undefined;
    }
    const rounded = roundTo(number, TEXT_LINE_STEP);
    if (rounded < TEXT_LINE_MIN || rounded > TEXT_LINE_MAX || rounded === TEXT_LINE_DEFAULT) {
        return undefined;
    }
    return rounded;
}

export function textTracking(value: unknown): number {
    const number = readNumber(value);
    if (number === undefined) {
        return TEXT_TRACKING_DEFAULT;
    }
    const rounded = roundTo(number, TEXT_TRACKING_STEP);
    if (rounded < TEXT_TRACKING_MIN || rounded > TEXT_TRACKING_MAX) {
        return TEXT_TRACKING_DEFAULT;
    }
    return rounded;
}

export function storedTextTracking(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const number = readNumber(value);
    if (number === undefined) {
        return undefined;
    }
    const rounded = roundTo(number, TEXT_TRACKING_STEP);
    if (rounded < TEXT_TRACKING_MIN || rounded > TEXT_TRACKING_MAX || rounded === TEXT_TRACKING_DEFAULT) {
        return undefined;
    }
    return rounded;
}
