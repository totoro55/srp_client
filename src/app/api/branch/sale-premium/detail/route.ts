import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { DETAIL_TIMEOUT_MESSAGE, isQueryTimeout } from "@/lib/detail-timeout";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { readSalePremiumDetail, type SalePremiumDetail } from "@/services/sale-premium";
import type { ApiResponse } from "@/types/api";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<SalePremiumDetail>>> {
    try {
        const access = await requireAnyPermission(["branch:read", "baskets:connect"]);
        const params = new URL(request.url).searchParams;
        const detail = await readSalePremiumDetail(
            access,
            params.get("period") ?? "",
            params.get("branch") ?? "",
            params.get("employee") ?? "",
            params.get("from"),
            params.get("until"),
        );
        if (!detail) {
            return createErrorResponse("NOT_FOUND", "Детализация продажи не найдена", 404);
        }
        return NextResponse.json({ success: true, data: detail });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (isQueryTimeout(error)) {
            return createErrorResponse("TIMEOUT", DETAIL_TIMEOUT_MESSAGE, 503);
        }
        console.error("Не удалось прочитать детализацию продажи", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать детализацию продажи", 500);
    }
}
