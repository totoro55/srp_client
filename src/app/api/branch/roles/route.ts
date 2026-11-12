import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { staffParticipationChanged } from "@/lib/motivation-roles";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { getAppSettings } from "@/services/app-settings";
import { PremiumRecalcBusyError } from "@/services/basket-updates";
import { recalculateBranchPremiums } from "@/services/branch-premium-recalc";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { MotivationSettingsError, readBranchRoleOverrides, readMotivationSettings, saveBranchRoleOverrides } from "@/services/motivation-roles";
import { SalePremiumError } from "@/services/sale-premium";
import type { ApiResponse } from "@/types/api";

const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BranchRolesPayload {
    saved: true;
    recalculated: boolean;
    closed: boolean;
    recalcMessage: string | null;
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    kassaPremiums: Record<string, number>;
    shares: Record<string, number>;
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<BranchRolesPayload>>> {
    try {
        const access = await requireAnyPermission(["branch:read", "baskets:connect"]);
        const body = await request.json() as { branchId?: unknown; period?: unknown; overrides?: unknown };
        const branchId = typeof body.branchId === "string" ? body.branchId : "";
        const period = typeof body.period === "string" ? body.period : null;
        if (!BRANCH_UUID.test(branchId) || !isStaffPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите филиал и месяц", 400);
        }
        const overrides = readOverrides(body.overrides);
        if (!overrides) {
            return createErrorResponse("BAD_REQUEST", "Некорректные назначения", 400);
        }
        const visible = await readBranchStaff(access, period, branchId);
        const allowed = visible.branches.some((branch) => branch.id.toLowerCase() === branchId.toLowerCase());
        if (!allowed) {
            return createErrorResponse("FORBIDDEN", "Филиал недоступен", 403);
        }
        const settings = await getAppSettings();
        const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
        if (!monthIsOpen(period.slice(0, 7), policy)) {
            return createErrorResponse("BAD_REQUEST", closedPeriodMessage(policy), 400);
        }
        const [motivation, before] = await Promise.all([
            readMotivationSettings(),
            readBranchRoleOverrides(branchId, period),
        ]);
        const participationChanged = staffParticipationChanged(visible.employees, before, overrides, motivation);
        await saveBranchRoleOverrides(branchId, period, overrides);
        let recalculated = false;
        let recalcMessage: string | null = null;
        if (participationChanged) {
            try {
                await recalculateBranchPremiums({
                    period,
                    branchId,
                    actor: access.username,
                    trigger: "branch.roles",
                });
                recalculated = true;
            } catch (error) {
                recalcMessage = error instanceof SalePremiumError || error instanceof PremiumRecalcBusyError
                    ? error.message
                    : "Не удалось пересчитать премию филиала";
                console.error("Не удалось пересчитать премию филиала после смены участия в расчёте", error);
            }
        }
        const fresh = recalculated ? await readBranchStaff(access, period, branchId) : null;
        return NextResponse.json({
            success: true,
            data: {
                saved: true,
                recalculated,
                closed: false,
                recalcMessage,
                salePremiums: fresh?.salePremiums ?? {},
                releasePremiums: fresh?.releasePremiums ?? {},
                kassaPremiums: fresh?.kassaPremiums ?? {},
                shares: fresh?.sharedPremiums ?? {},
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof MotivationSettingsError) {
            return createErrorResponse("BAD_REQUEST", error.message, 400);
        }
        console.error("Не удалось сохранить роли филиала", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить роли филиала", 500);
    }
}

function readOverrides(value: unknown): Record<string, string | null> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const overrides: Record<string, string | null> = {};
    for (const [employeeId, roleId] of Object.entries(value)) {
        if (roleId === null) {
            overrides[employeeId] = null;
            continue;
        }
        if (typeof roleId !== "string" || !roleId.trim()) {
            return null;
        }
        overrides[employeeId] = roleId.trim().toLowerCase();
    }
    return overrides;
}
