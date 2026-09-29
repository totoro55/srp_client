import { NextResponse } from "next/server";
import { adminAuthErrorResponse, getActiveAccess } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";
import { ApiResponse, SessionAccess } from "@/types/api";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isSuperuser } from "@/lib/roles";

export async function GET(): Promise<NextResponse<ApiResponse<SessionAccess>>> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return createErrorResponse("UNAUTHORIZED", "Требуется авторизация", 401);
        }

        const active = await getActiveAccess();
        return NextResponse.json({
            success: true,
            data: {
                role: active.activeRole,
                roleId: active.activeRoleId,
                isSuperuser: active.isSuperuser,
                originalIsSuperuser: isSuperuser(session.user.isSuperuser, session.user.role),
                codes: active.codes,
                impersonatedRole: active.isImpersonating ? active.activeRole : null,
                impersonatedRoleId: active.isImpersonating ? active.activeRoleId : null,
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Не удалось получить права сессии", 500);
    }
}
