import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { readBranchRoleOverrides } from "@/services/motivation-roles";
import type { ApiResponse } from "@/types/api";
import type { BranchOption, BranchStaffRow, ConnectedBasketIndicator } from "@/services/branch-staff";

export interface BranchStaffPayload {
    branches: BranchOption[];
    employees: BranchStaffRow[];
    roleOverrides: Record<string, string | null>;
    indicators: ConnectedBasketIndicator[];
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    baseBonus: number | null;
    priceGrowth: number;
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<BranchStaffPayload>>> {
    try {
        const access = await requireAnyPermission(["branch:read", "baskets:connect"]);
        const params = new URL(request.url).searchParams;
        const period = params.get("period");
        if (!isStaffPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц", 400);
        }
        const branch = params.get("branch");
        const data = await readBranchStaff(access, period, branch);
        const visible = Boolean(branch && data.branches.some((item) => item.id.toLowerCase() === branch.toLowerCase()));
        const roleOverrides = visible && branch ? await readBranchRoleOverrides(branch) : {};
        return NextResponse.json({ success: true, data: { ...data, roleOverrides } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать штатное расписание", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать штатное расписание", 500);
    }
}
