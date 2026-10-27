import { newsColor } from "@/lib/news-format";

const STORAGE_KEY = "srp.editor.colors";
const USER_COLOR_LIMIT = 8;

export function readUserColors(): string[] {
    if (typeof window === "undefined") {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (!Array.isArray(parsed)) {
            return [];
        }
        const colors: string[] = [];
        for (const item of parsed) {
            const color = newsColor(item);
            if (color && !colors.includes(color)) {
                colors.push(color);
            }
        }
        return colors.slice(0, USER_COLOR_LIMIT);
    } catch {
        return [];
    }
}

export function rememberUserColor(value: string): string[] {
    const color = newsColor(value);
    const current = readUserColors();
    if (!color) {
        return current;
    }
    const colors = [color, ...current.filter((item) => item !== color)].slice(0, USER_COLOR_LIMIT);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
    return colors;
}

export function colorsInDocument(node: unknown): string[] {
    const colors: string[] = [];
    const visit = (current: unknown) => {
        if (!current || typeof current !== "object") {
            return;
        }
        const record = current as {
            attrs?: Record<string, unknown>;
            marks?: { attrs?: Record<string, unknown> }[];
            content?: unknown[];
        };
        const found = [
            record.attrs?.color,
            record.attrs?.backgroundColor,
            record.attrs?.borderColor,
            ...(record.marks ?? []).map((mark) => mark.attrs?.color),
        ];
        for (const value of found) {
            const color = newsColor(value);
            if (color && !colors.includes(color)) {
                colors.push(color);
            }
        }
        for (const child of record.content ?? []) {
            visit(child);
        }
    };
    visit(node);
    return colors;
}
