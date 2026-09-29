import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createErrorResponse } from "@/lib/api-error";
import { hasPermissionCode } from "@/lib/access";
import type { PermissionCode } from "@/lib/permissions";
import { getActiveSessionContext, type ActiveAccessContext } from "@/services/impersonation";
import { ApiErrorResponse } from "@/types/api";

export class AdminAuthError extends Error {
    readonly status: 401 | 403;

    constructor(status: 401 | 403) {
        super(status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
        this.name = "AdminAuthError";
        this.status = status;
    }
}

export async function getActiveAccess(): Promise<ActiveAccessContext & { username: string }> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new AdminAuthError(401);
    }

    const jar = await cookies();
    const originalIsSuperuser =
        session.user.isSuperuser || session.user.role === "ADMIN" || session.user.role === "admin";

    const active = await getActiveSessionContext(
        session.user.role,
        session.user.roleId,
        originalIsSuperuser,
        jar
    );

    return {
        ...active,
        username: session.user.username || "SYSTEM",
    };
}

export async function requireOriginalSuperuser(): Promise<{ username: string }> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new AdminAuthError(401);
    }

    const originalIsSuperuser =
        session.user.isSuperuser || session.user.role === "ADMIN" || session.user.role === "admin";

    if (!originalIsSuperuser) {
        throw new AdminAuthError(403);
    }

    return { username: session.user.username || "SYSTEM" };
}

export async function requirePermission(permission: PermissionCode): Promise<{ username: string }> {
    const active = await getActiveAccess();

    if (active.isSuperuser || hasPermissionCode(active.codes, permission)) {
        return { username: active.username };
    }

    throw new AdminAuthError(403);
}

/** @deprecated Use requireOriginalSuperuser or requirePermission */
export async function requireAdmin(): Promise<{ username: string }> {
    return requireOriginalSuperuser();
}

export function adminAuthErrorResponse(
    error: unknown
): NextResponse<ApiErrorResponse> | null {
    if (!(error instanceof AdminAuthError)) {
        return null;
    }

    if (error.status === 401) {
        return createErrorResponse("UNAUTHORIZED", "Требуется авторизация", 401);
    }

    return createErrorResponse("FORBIDDEN", "Доступ ограничен", 403);
}
