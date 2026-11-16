import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { DETAIL_TIMEOUT_MESSAGE, isQueryTimeout } from "@/lib/detail-timeout";
import { CABINET_PERMISSIONS } from "@/lib/permissions";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { DetailForbiddenError } from "@/services/premium-access";
import { readUnloadingPremiumDetail, type UnloadingPremiumDetail } from "@/services/unloading-premium";
import type { ApiResponse } from "@/types/api";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<UnloadingPremiumDetail>>> {
    try {
        const access = await requireAnyPermission([...CABINET_PERMISSIONS]);
        const params = new URL(request.url).searchParams;
        const detail = await readUnloadingPremiumDetail(
            access,
            params.get("period") ?? "",
            params.get("branch") ?? "",
            params.get("employee") ?? "",
            params.get("from"),
            params.get("until"),
        );
        if (!detail) {
            return createErrorResponse("NOT_FOUND", "Детализация разгрузки ТС не найдена", 404);
        }
        return NextResponse.json({ success: true, data: detail });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof DetailForbiddenError) {
            return createErrorResponse("FORBIDDEN", error.message, 403);
        }
        if (isQueryTimeout(error)) {
            return createErrorResponse("TIMEOUT", DETAIL_TIMEOUT_MESSAGE, 503);
        }
        console.error("Не удалось прочитать детализацию разгрузки ТС", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать детализацию разгрузки ТС", 500);
    }
}
