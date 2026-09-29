import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { NextResponse } from "next/server";
import { isAdminRole } from "@/lib/roles";
import { UserPermission } from "@/types/next-auth";

export const IMPERSONATION_COOKIE_ROLE = "impersonated_role";
export const IMPERSONATION_COOKIE_ROLE_ID = "impersonated_role_id";
export const IMPERSONATION_COOKIE_MAX_AGE = 60 * 60 * 2;

interface ImpersonationResult {
    activeRole: string;
    activePermissions: UserPermission[];
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

export async function loadRolePermissions(roleId: number): Promise<UserPermission[]> {
    const { db } = await import("@/services/db");

    const rolePerms = await db.query<{ path: string; method: string }>(
        `
        SELECT p.route_path as path, p.method
        FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = $1
        `,
        [roleId]
    );

    return rolePerms.map((permission) => ({
        path: permission.path,
        method: permission.method,
    }));
}

export async function getActiveSessionContext(
    originalRole: string | undefined,
    originalPermissions: UserPermission[],
    cookies: RequestCookies
): Promise<ImpersonationResult> {
    const result: ImpersonationResult = {
        activeRole: originalRole || "",
        activePermissions: originalPermissions,
        isImpersonating: false,
    };

    const impersonatedRole = cookies.get(IMPERSONATION_COOKIE_ROLE)?.value;
    const impersonatedRoleId = cookies.get(IMPERSONATION_COOKIE_ROLE_ID)?.value;

    if (!isAdminRole(originalRole) || !impersonatedRole) {
        return result;
    }

    result.activeRole = impersonatedRole;
    result.isImpersonating = true;

    if (impersonatedRole === "ADMIN" || impersonatedRole === "admin") {
        return result;
    }

    const parsedRoleId = Number.parseInt(impersonatedRoleId ?? "", 10);
    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
        result.activePermissions = [];
        return result;
    }

    try {
        result.activePermissions = await loadRolePermissions(parsedRoleId);
    } catch (error) {
        console.error("Ошибка при динамическом сборе прав для тестируемой роли:", error);
        result.activePermissions = [];
    }

    return result;
}
