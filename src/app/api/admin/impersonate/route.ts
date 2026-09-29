import { NextResponse } from "next/server";
import { db } from "@/services/db";
import {
    adminAuthErrorResponse,
    getActiveAccess,
    requireOriginalSuperuser,
} from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";
import {
    clearImpersonationCookies,
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
        await requireOriginalSuperuser();
        const active = await getActiveAccess();
        return NextResponse.json({
            success: true,
            data: {
                impersonatedRole: active.isImpersonating ? active.activeRole : null,
                impersonatedRoleId: active.isImpersonating ? active.activeRoleId : null,
                codes: active.codes,
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
        await requireOriginalSuperuser();

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

        const role = await db.getRoleById(roleId);
        if (!role || role.name !== roleName) {
            return createErrorResponse("BAD_REQUEST", "Роль не найдена", 400);
        }

        if (role.is_superuser) {
            clearImpersonationCookies(response);
            return response;
        }

        setImpersonationCookies(response, role.name, role.id);
        return response;
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Ошибка сервера", 500);
    }
}
