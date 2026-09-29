import { NextResponse } from "next/server";
import {
    getCachedRoleCodes,
    setCachedRoleCodes,
} from "@/services/permission-cache";

type CookieReader = {
    get(name: string): { value: string } | undefined;
};

export const IMPERSONATION_COOKIE_ROLE = "impersonated_role";
export const IMPERSONATION_COOKIE_ROLE_ID = "impersonated_role_id";
export const IMPERSONATION_COOKIE_MAX_AGE = 60 * 60 * 2;

export interface ActiveAccessContext {
    activeRole: string;
    activeRoleId: number | null;
    isSuperuser: boolean;
    codes: string[];
    isImpersonating: boolean;
}

export function impersonationCookieOptions(maxAge: number) {
    return {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        maxAge,
    };
}

export function setImpersonationCookies(
    response: NextResponse,
    roleName: string,
    roleId: number
): void {
    const options = impersonationCookieOptions(IMPERSONATION_COOKIE_MAX_AGE);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE, roleName, options);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE_ID, String(roleId), options);
}

export function clearImpersonationCookies(response: NextResponse): void {
    const options = impersonationCookieOptions(0);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE, "", options);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE_ID, "", options);
}

export async function loadRolePermissionCodes(roleId: number): Promise<string[]> {
    const cached = getCachedRoleCodes(roleId);
    if (cached) {
        return cached;
    }

    const { db } = await import("@/services/db");
    const rows = await db.query<{ code: string }>(
        `
        SELECT p.code
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = $1
          AND p.code IS NOT NULL
          AND p.code NOT LIKE 'legacy:%'
        `,
        [roleId]
    );

    return setCachedRoleCodes(
        roleId,
        rows.map((row) => row.code)
    );
}

export async function resolveRoleRecord(roleId?: number | null, roleName?: string | null) {
    const { db } = await import("@/services/db");
    if (typeof roleId === "number" && roleId > 0) {
        const byId = await db.getRoleById(roleId);
        if (byId) {
            return byId;
        }
    }
    if (roleName) {
        return db.getRoleByName(roleName);
    }
    return null;
}

export async function getActiveSessionContext(
    originalRole: string | undefined,
    originalRoleId: number | undefined,
    originalIsSuperuser: boolean,
    cookies: CookieReader
): Promise<ActiveAccessContext> {
    const originalRecord = await resolveRoleRecord(originalRoleId, originalRole);
    const result: ActiveAccessContext = {
        activeRole: originalRecord?.name || originalRole || "",
        activeRoleId: originalRecord?.id ?? originalRoleId ?? null,
        isSuperuser: originalRecord?.is_superuser ?? originalIsSuperuser,
        codes: [],
        isImpersonating: false,
    };

    if (!originalRecord?.is_superuser && !originalIsSuperuser) {
        if (result.activeRoleId) {
            result.codes = await loadRolePermissionCodes(result.activeRoleId);
        }
        return result;
    }

    const impersonatedRole = cookies.get(IMPERSONATION_COOKIE_ROLE)?.value;
    const impersonatedRoleIdRaw = cookies.get(IMPERSONATION_COOKIE_ROLE_ID)?.value;
    const impersonatedRoleId = Number.parseInt(impersonatedRoleIdRaw ?? "", 10);

    if (!impersonatedRole) {
        return result;
    }

    const masked = await resolveRoleRecord(
        Number.isInteger(impersonatedRoleId) ? impersonatedRoleId : null,
        impersonatedRole
    );

    if (!masked) {
        result.codes = [];
        result.isImpersonating = true;
        result.isSuperuser = false;
        result.activeRole = impersonatedRole;
        result.activeRoleId = null;
        return result;
    }

    result.activeRole = masked.name;
    result.activeRoleId = masked.id;
    result.isImpersonating = true;
    result.isSuperuser = masked.is_superuser;
    result.codes = masked.is_superuser ? [] : await loadRolePermissionCodes(masked.id);
    return result;
}
