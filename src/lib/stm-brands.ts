export interface StmBrand {
    name: string;
    setAt: string;
    setBy: string;
}

const MAX_NAME = 255;

export function stmBrandName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const name = value.trim().replace(/\s+/g, " ");
    if (name.length === 0 || name.length > MAX_NAME) {
        return null;
    }
    return name;
}
