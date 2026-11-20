export interface StmBrand {
    name: string;
    setAt: string;
    setBy: string;
}

export const STM_BRAND_NAME_MAX = 255;

export function stmBrandKey(name: string): string {
    return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function stmBrandName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const name = value.trim().replace(/\s+/g, " ");
    if (name.length === 0 || name.length > STM_BRAND_NAME_MAX) {
        return null;
    }
    return name;
}
