import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { readReleasePremiumDetail, type ReleasePremiumDetail, type ReleasePremiumDetailQuery } from "@/services/release-premium";
import type { ApiResponse } from "@/types/api";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<ReleasePremiumDetail>>> {
    try {
        const access = await requireAnyPermission(["branch:read", "baskets:connect"]);
        const params = new URL(request.url).searchParams;
        const detail = await readReleasePremiumDetail(
            access,
            params.get("period") ?? "",
            params.get("branch") ?? "",
            params.get("employee") ?? "",
            params.get("from"),
            params.get("until"),
            readDetailQuery(params),
        );
        if (!detail) {
            return createErrorResponse("NOT_FOUND", "Детализация выдачи не найдена", 404);
        }
        return NextResponse.json({ success: true, data: detail });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать детализацию выдачи", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать детализацию выдачи", 500);
    }
}

function readDetailQuery(params: URLSearchParams): ReleasePremiumDetailQuery {
    const page = Number(params.get("page"));
    const pageSize = Number(params.get("pageSize"));
    return {
        mode: params.get("mode") === "document" ? "document" : "category",
        page: Number.isInteger(page) && page > 0 ? page : 0,
        pageSize: Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 100 ? pageSize : 14,
        query: (params.get("q") ?? "").trim().slice(0, 200),
    };
}
