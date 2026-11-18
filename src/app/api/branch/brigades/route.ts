import { NextResponse } from "next/server";
import { can } from "@/lib/access";
import { BRIGADE_INDICATORS } from "@/lib/brigade-shares";
import { createErrorResponse } from "@/lib/api-error";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { AdminAuthError, adminAuthErrorResponse } from "@/lib/require-admin";
import { getRequestAccess } from "@/server/authz/resolve-access";
import { getAppSettings } from "@/services/app-settings";
import { PremiumRecalcBusyError } from "@/services/basket-updates";
import { BrigadeSetupError, parseBrigadeSetup, saveBranchBrigadeSetup, type BrigadeSetupRecord } from "@/services/branch-brigades";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { runBrigadeJournal } from "@/services/brigade-recalc";
import { holdsBranchSetting, managerMayChangeBranch } from "@/services/manager-branch-grants";
import { SalePremiumError } from "@/services/sale-premium";
import type { ApiResponse } from "@/types/api";

interface BranchBrigadesPayload {
    saved: true;
    brigades: BrigadeSetupRecord;
    recalculated: boolean;
    recalcMessage: string | null;
    salePremiums: Record<string, number>;
    releasePremiums: Record<string, number>;
    kassaPremiums: Record<string, number>;
    osntPremiums: Record<string, number>;
    warehousePremiums: Record<string, number>;
    unloadingPremiums: Record<string, number>;
    selectionPremiums: Record<string, number>;
    shares: Record<string, number>;
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<BranchBrigadesPayload>>> {
    try {
        const access = await getRequestAccess();
        if (!access || !holdsBranchSetting(access, "branch.brigades:write")) {
            throw new AdminAuthError(access ? 403 : 401);
        }
        const body = await request.json() as { branchId?: unknown; period?: unknown; brigades?: unknown; skipRecalc?: unknown };
        const skipRecalc = body.skipRecalc === true;
        if (skipRecalc && !can(access, "branch.skip-recalc:write")) {
            return createErrorResponse("FORBIDDEN", "Нет права сохранить без пересчёта", 403);
        }
        const branchId = typeof body.branchId === "string" ? body.branchId : "";
        const period = typeof body.period === "string" ? body.period : null;
        if (!isStaffPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите филиал и месяц", 400);
        }
        const setup = parseBrigadeSetup(body.brigades);
        if (!setup) {
            return createErrorResponse("BAD_REQUEST", "Некорректный состав бригад", 400);
        }
        const visible = await readBranchStaff(access, period, branchId);
        const allowed = visible.branches.some((branch) => branch.id.toLowerCase() === branchId.toLowerCase());
        if (!allowed) {
            return createErrorResponse("FORBIDDEN", "Филиал недоступен", 403);
        }
        if (!await managerMayChangeBranch(access, branchId, "branch.brigades:write")) {
            return createErrorResponse("FORBIDDEN", "Для этого филиала настройка не выдана", 403);
        }
        const settings = await getAppSettings();
        const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
        if (!monthIsOpen(period.slice(0, 7), policy)) {
            return createErrorResponse("BAD_REQUEST", closedPeriodMessage(policy), 400);
        }
        const saved = await saveBranchBrigadeSetup(branchId, period, setup);
        let recalculated = false;
        let recalcMessage: string | null = null;
        if (!skipRecalc) {
            try {
                await runBrigadeJournal({
                    period,
                    indicators: BRIGADE_INDICATORS,
                    actor: access.username,
                    trigger: "branch.brigades",
                    origin: "manual",
                    scopeLevel: "branch",
                    scopeIds: [branchId],
                    route: "/api/branch/brigades",
                    run: { branch: branchId.toLowerCase() },
                });
                recalculated = true;
            } catch (error) {
                recalcMessage = error instanceof SalePremiumError || error instanceof PremiumRecalcBusyError
                    ? error.message
                    : "Не удалось пересчитать доли бригады";
                console.error("Не удалось пересчитать доли бригады", error);
            }
        }
        const fresh = recalculated ? await readBranchStaff(access, period, branchId) : null;
        return NextResponse.json({
            success: true,
            data: {
                saved: true,
                brigades: saved,
                recalculated,
                recalcMessage,
                salePremiums: fresh?.salePremiums ?? {},
                releasePremiums: fresh?.releasePremiums ?? {},
                kassaPremiums: fresh?.kassaPremiums ?? {},
                osntPremiums: fresh?.osntPremiums ?? {},
                warehousePremiums: fresh?.warehousePremiums ?? {},
                unloadingPremiums: fresh?.unloadingPremiums ?? {},
                selectionPremiums: fresh?.selectionPremiums ?? {},
                shares: fresh?.sharedPremiums ?? {},
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof BrigadeSetupError) {
            return createErrorResponse("BAD_REQUEST", error.message, 400);
        }
        console.error("Не удалось сохранить бригады филиала", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить бригады филиала", 500);
    }
}
