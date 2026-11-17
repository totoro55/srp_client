import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { BRANCH_SETTINGS_PERMISSIONS, CABINET_PERMISSIONS } from "@/lib/permissions";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { isStaffPeriod } from "@/services/branch-staff";
import { readBranchRecalcStatus, type BranchRecalcStatus } from "@/services/branch-recalc-status";
import type { ApiResponse } from "@/types/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<NextResponse<ApiResponse<BranchRecalcStatus>>> {
    try {
        await requireAnyPermission(["branch.tariffs:read", ...BRANCH_SETTINGS_PERMISSIONS, ...CABINET_PERMISSIONS]);
        const url = new URL(request.url);
        const branchId = url.searchParams.get("branch") ?? "";
        const period = url.searchParams.get("period") ?? "";
        if (!UUID.test(branchId) || !isStaffPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите филиал и месяц", 400);
        }
        const data = await readBranchRecalcStatus(branchId, period);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось проверить пересчёт филиала", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось проверить пересчёт филиала", 500);
    }
}
