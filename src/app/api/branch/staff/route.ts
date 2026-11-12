import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { getAppSettings } from "@/services/app-settings";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { readBranchRoleOverrides } from "@/services/motivation-roles";
import { readBranchSharedPremiumRoleIds } from "@/services/shared-premium";
import type { ApiResponse } from "@/types/api";
import type { BranchOption, BranchStaffRow, ConnectedBasketIndicator } from "@/services/branch-staff";

export interface BranchStaffPayload {
    branches: BranchOption[];
    employees: BranchStaffRow[];
    roleOverrides: Record<string, string | null>;
    indicators: ConnectedBasketIndicator[];
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    kassaPremiums: Record<string, number>;
    sharedPremiums: Record<string, number>;
    sharedPremiumRoleIds: string[];
    baseBonus: number | null;
    priceGrowth: number;
    rosterPeriod: string | null;
    rolesEditable: boolean;
    closedMessage: string | null;
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
        const roleOverrides = visible && branch ? await readBranchRoleOverrides(branch, period) : {};
        const sharedPremiumRoleIds = visible && branch ? await readBranchSharedPremiumRoleIds(branch) : [];
        const settings = await getAppSettings();
        const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
        const rolesEditable = monthIsOpen(period.slice(0, 7), policy);
        return NextResponse.json({
            success: true,
            data: {
                ...data,
                roleOverrides,
                sharedPremiumRoleIds,
                rolesEditable,
                closedMessage: rolesEditable ? null : closedPeriodMessage(policy),
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать штатное расписание", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать штатное расписание", 500);
    }
}
