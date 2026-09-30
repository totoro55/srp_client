import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createErrorResponse } from "@/lib/api-error";
import { can } from "@/lib/access";
import type { PermissionCode } from "@/lib/permissions";
import { ApiErrorResponse } from "@/types/api";
import { getRequestAccess, resolveAccess, type AccessView } from "@/server/authz/resolve-access";

export class AdminAuthError extends Error {
    readonly status: 401 | 403;

    constructor(status: 401 | 403, message?: string) {
        super(message ?? (status === 401 ? "Требуется авторизация" : "Доступ ограничен"));
        this.name = "AdminAuthError";
        this.status = status;
    }
}

export async function getActiveAccess(): Promise<AccessView> {
    const access = await getRequestAccess();
    if (!access) {
        throw new AdminAuthError(401);
    }
    return access;
}

export async function requirePermission(permission: PermissionCode): Promise<AccessView> {
    const access = await getActiveAccess();
    if (!can(access, permission)) {
        throw new AdminAuthError(403);
    }
    return access;
}

export async function requireActorFullAccess(): Promise<AccessView> {
    const session = await getServerSession(authOptions);
    if (!session?.user?.username) {
        throw new AdminAuthError(401);
    }

    const actor = await resolveAccess(session.user.username, session.user.title ?? "", null);
    if (!actor.actorFullAccess) {
        throw new AdminAuthError(403);
    }
    return actor;
}

export function adminAuthErrorResponse(error: unknown): NextResponse<ApiErrorResponse> | null {
    if (!(error instanceof AdminAuthError)) {
        return null;
    }

    if (error.status === 401) {
        return createErrorResponse("UNAUTHORIZED", error.message, 401);
    }

    return createErrorResponse("FORBIDDEN", error.message, 403);
}

export async function readPreviewRoleId(): Promise<number | null> {
    const jar = await cookies();
    const previewRoleId = Number.parseInt(jar.get("impersonated_role_id")?.value ?? "", 10);
    return Number.isInteger(previewRoleId) && previewRoleId > 0 ? previewRoleId : null;
}
