import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { isStaffingPeriod, readStaffing, type StaffingView } from "@/services/staffing";
import type { ApiResponse } from "@/types/api";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<StaffingView>>> {
    try {
        const access = await requirePermission("staffing:read");
        const url = new URL(request.url);
        const period = url.searchParams.get("period");
        if (!isStaffingPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц", 400);
        }
        const view = await readStaffing(
            access,
            period,
            url.searchParams.get("branch") ?? "",
            url.searchParams.get("territory") ?? "",
            url.searchParams.get("q") ?? "",
        );
        return NextResponse.json({ success: true, data: view });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить штатное расписание", 500);
    }
}
