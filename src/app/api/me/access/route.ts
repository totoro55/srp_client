import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse } from "@/lib/require-admin";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { ApiResponse } from "@/types/api";
import type { PermissionCode } from "@/lib/permissions";

export interface SessionAccessPayload {
    username: string;
    roleCode: string | null;
    roleName: string | null;
    scopeLabel: string;
    fullAccess: boolean;
    actorFullAccess: boolean;
    permissions: PermissionCode[];
    previewRoleName: string | null;
    conflict: boolean;
    previewChoices: { id: number; name: string }[];
}

export async function GET(): Promise<NextResponse<ApiResponse<SessionAccessPayload>>> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return createErrorResponse("UNAUTHORIZED", "Требуется авторизация", 401);
        }

        const access = await getRequestAccess();
        if (!access) {
            return createErrorResponse("UNAUTHORIZED", "Требуется авторизация", 401);
        }

        return NextResponse.json({
            success: true,
            data: {
                username: access.username,
                roleCode: access.role?.code ?? null,
                roleName: access.role?.name ?? null,
                scopeLabel: access.scopeLabel,
                fullAccess: access.fullAccess,
                actorFullAccess: access.actorFullAccess,
                permissions: access.permissions,
                previewRoleName: access.previewRoleName,
                conflict: access.conflict,
                previewChoices: access.previewChoices,
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Не удалось получить права сессии", 500);
    }
}
