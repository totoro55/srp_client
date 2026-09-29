const CACHE_TTL_MS = 30_000;

interface CacheEntry {
    codes: string[];
    expiresAt: number;
}

const roleCodesCache = new Map<number, CacheEntry>();

export function getCachedRoleCodes(roleId: number): string[] | null {
    const entry = roleCodesCache.get(roleId);
    if (!entry) {
        return null;
    }
    if (Date.now() > entry.expiresAt) {
        roleCodesCache.delete(roleId);
        return null;
    }
    return entry.codes;
}

export function setCachedRoleCodes(roleId: number, codes: string[]): string[] {
    roleCodesCache.set(roleId, {
        codes,
        expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return codes;
}

export function invalidateRolePermissionCache(roleId?: number): void {
    if (typeof roleId === "number") {
        roleCodesCache.delete(roleId);
        return;
    }
    roleCodesCache.clear();
}
