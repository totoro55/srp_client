import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { isStaffPeriod } from "@/services/branch-staff";
import { readBranchTariffs, type BranchTariffPage } from "@/services/branch-tariffs";
import type { ApiResponse } from "@/types/api";

const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<NextResponse<ApiResponse<BranchTariffPage>>> {
    try {
        const access = await requirePermission("branch.tariffs:read");
        const params = new URL(request.url).searchParams;
        const period = params.get("period");
        const branchId = params.get("branch") ?? "";
        if (!isStaffPeriod(period) || !BRANCH_UUID.test(branchId)) {
            return createErrorResponse("BAD_REQUEST", "Укажите филиал и месяц", 400);
        }
        const page = await readBranchTariffs(access, period, branchId);
        if (!page) {
            return createErrorResponse("FORBIDDEN", "Филиал недоступен", 403);
        }
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать тарифы филиала", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать тарифы филиала", 500);
    }
}
