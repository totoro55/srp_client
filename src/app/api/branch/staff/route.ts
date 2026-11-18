import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { BRANCH_SETTINGS_PERMISSIONS, CABINET_PERMISSIONS } from "@/lib/permissions";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { getAppSettings } from "@/services/app-settings";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { managerBranchSettings } from "@/services/manager-branch-grants";
import { cabinetViewer, readBranchPlacement, type BranchChoice } from "@/services/premium-access";
import { readBranchBrigadeSetup } from "@/services/branch-brigades";
import { readBranchRoleOverrides } from "@/services/motivation-roles";
import { readBranchSharedPremiumRoleIds } from "@/services/shared-premium";
import type { ApiResponse } from "@/types/api";
import type { BranchOption, BranchStaffRow, ConnectedBasketIndicator } from "@/services/branch-staff";

export interface BranchStaffPayload {
    branches: BranchOption[];
    employees: BranchStaffRow[];
    roleOverrides: Record<string, string | null>;
    brigades: { mode: "off" | "all" | "groups"; groups: { id: string; name: string; memberIds: string[] }[] };
    indicators: ConnectedBasketIndicator[];
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    kassaPremiums: Record<string, number>;
    osntPremiums: Record<string, number>;
    warehousePremiums: Record<string, number>;
    unloadingPremiums: Record<string, number>;
    selectionPremiums: Record<string, number>;
    sharedPremiums: Record<string, number>;
    sharedPremiumRoleIds: string[];
    baseBonus: number | null;
    priceGrowth: number;
    rosterPeriod: string | null;
    branchSettings: {
        roles: boolean;
        brigades: boolean;
        shared: boolean;
    };
    rolesEditable: boolean;
    closedMessage: string | null;
    viewer: {
        employeeId: string | null;
        foreignDetail: boolean;
        branchChoice: BranchChoice;
        workedBranchIds: string[];
        preferredBranchId: string | null;
    };
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<BranchStaffPayload>>> {
    try {
        const access = await requireAnyPermission(["branch.tariffs:read", ...BRANCH_SETTINGS_PERMISSIONS, ...CABINET_PERMISSIONS]);
        const params = new URL(request.url).searchParams;
        const period = params.get("period");
        if (!isStaffPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц", 400);
        }
        const branch = params.get("branch");
        const data = await readBranchStaff(access, period, branch);
        const visible = Boolean(branch && data.branches.some((item) => item.id.toLowerCase() === branch.toLowerCase()));
        const roleOverrides = visible && branch ? await readBranchRoleOverrides(branch, period) : {};
        const brigades = visible && branch ? await readBranchBrigadeSetup(branch, period) : { mode: "off" as const, groups: [] };
        const sharedPremiumRoleIds = visible && branch ? await readBranchSharedPremiumRoleIds(branch) : [];
        const [viewer, placement, branchSettings] = await Promise.all([
            cabinetViewer(access),
            readBranchPlacement(access, period),
            visible && branch ? managerBranchSettings(access, branch) : Promise.resolve({ roles: false, brigades: false, shared: false }),
        ]);
        const settings = await getAppSettings();
        const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
        const rolesEditable = monthIsOpen(period.slice(0, 7), policy);
        return NextResponse.json({
            success: true,
            data: {
                ...data,
                roleOverrides,
                brigades,
                sharedPremiumRoleIds,
                branchSettings,
                rolesEditable,
                closedMessage: rolesEditable ? null : closedPeriodMessage(policy),
                viewer: { ...viewer, ...placement },
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
