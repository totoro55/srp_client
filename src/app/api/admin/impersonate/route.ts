import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/services/db";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";
import {
    IMPERSONATION_COOKIE_ROLE,
    IMPERSONATION_COOKIE_ROLE_ID,
    clearImpersonationCookies,
    loadRolePermissions,
    setImpersonationCookies,
} from "@/services/impersonation";
import { ApiResponse, ImpersonationStatus } from "@/types/api";

interface ImpersonatePostBody {
    roleId?: unknown;
    roleName?: unknown;
}

function parsePositiveInt(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

export async function GET(): Promise<NextResponse<ApiResponse<ImpersonationStatus>>> {
    try {
        await requireAdmin();

        const jar = await cookies();
        const impersonatedRole = jar.get(IMPERSONATION_COOKIE_ROLE)?.value ?? null;
        const roleIdRaw = jar.get(IMPERSONATION_COOKIE_ROLE_ID)?.value ?? null;
        const impersonatedRoleId = parsePositiveInt(roleIdRaw);

        let permissions: ImpersonationStatus["permissions"] = [];

        if (impersonatedRole && impersonatedRole !== "ADMIN" && impersonatedRole !== "admin" && impersonatedRoleId) {
            permissions = await loadRolePermissions(impersonatedRoleId);
        }

        return NextResponse.json({
            success: true,
            data: {
                impersonatedRole,
                impersonatedRoleId,
                permissions,
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Не удалось прочитать статус имперсонации", 500);
    }
}

export async function POST(request: Request) {
    try {
        await requireAdmin();

        const body = (await request.json()) as ImpersonatePostBody;
        const roleName = typeof body.roleName === "string" ? body.roleName.trim() : "";

        const response = NextResponse.json({ success: true });

        if (!roleName || roleName === "RESET") {
            clearImpersonationCookies(response);
            return response;
        }

        const roleId = parsePositiveInt(body.roleId);
        if (!roleId) {
            return createErrorResponse("BAD_REQUEST", "Некорректный идентификатор роли", 400);
        }

        const roles = await db.query<{ id: number; name: string }>(
            "SELECT id, name FROM roles WHERE id = $1",
            [roleId]
        );

        if (roles.length === 0 || roles[0].name !== roleName) {
            return createErrorResponse("BAD_REQUEST", "Роль не найдена", 400);
        }

        setImpersonationCookies(response, roles[0].name, roles[0].id);
        return response;
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Ошибка сервера", 500);
    }
}
