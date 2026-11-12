import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { CABINET_PERMISSIONS } from "@/lib/permissions";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { readSharedPremiumAuthors, type SharedPremiumAuthorRow } from "@/services/shared-premium";
import type { ApiResponse } from "@/types/api";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<SharedPremiumAuthorRow[]>>> {
    try {
        const access = await requireAnyPermission([...CABINET_PERMISSIONS]);
        const params = new URL(request.url).searchParams;
        const authors = await readSharedPremiumAuthors(access, params.get("period") ?? "", params.get("branch") ?? "");
        if (!authors) {
            return createErrorResponse("NOT_FOUND", "Общая премия филиала не найдена", 404);
        }
        return NextResponse.json({ success: true, data: authors });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать авторов общей премии", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать авторов общей премии", 500);
    }
}
