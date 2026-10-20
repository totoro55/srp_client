export const ADMIN_PAGE_SIZE = 20;

export function parseListPage(value: string | null): number {
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1 || page > 100_000) {
        return 1;
    }
    return page;
}

export function likePattern(value: string): string {
    return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function pageCount(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(total / pageSize));
}
