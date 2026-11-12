import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { MotivationSettingsError } from "@/services/motivation-roles";
import { saveBranchSharedPremiumRoles } from "@/services/shared-premium";
import type { ApiResponse } from "@/types/api";

const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_ID = /^[a-z][a-z0-9-]{0,39}$/;

interface SharedPremiumRolesPayload {
    saved: true;
    recalculated: boolean;
    recalcMessage: string | null;
    roleIds: string[];
    shares: Record<string, number>;
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<SharedPremiumRolesPayload>>> {
    try {
        const access = await requireAnyPermission(["branch:read", "baskets:connect"]);
        const body = await request.json() as { branchId?: unknown; period?: unknown; roleIds?: unknown };
        const branchId = typeof body.branchId === "string" ? body.branchId : "";
        const period = typeof body.period === "string" ? body.period : "";
        if (!BRANCH_UUID.test(branchId) || !isStaffPeriod(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите филиал и месяц", 400);
        }
        const roleIds = readRoleIds(body.roleIds);
        if (!roleIds) {
            return createErrorResponse("BAD_REQUEST", "Выберите роль из списка", 400);
        }
        const visible = await readBranchStaff(access, period, null);
        const allowed = visible.branches.some((branch) => branch.id.toLowerCase() === branchId.toLowerCase());
        if (!allowed) {
            return createErrorResponse("FORBIDDEN", "Филиал недоступен", 403);
        }
        const saved = await saveBranchSharedPremiumRoles(branchId, period, roleIds, access.username);
        return NextResponse.json({
            success: true,
            data: {
                saved: true,
                recalculated: saved.recalculated,
                recalcMessage: saved.recalcMessage,
                roleIds,
                shares: saved.shares,
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
        console.error("Не удалось сохранить роли общей премии", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить роли общей премии", 500);
    }
}

function readRoleIds(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const roleIds: string[] = [];
    for (const item of value) {
        if (typeof item !== "string" || !ROLE_ID.test(item.trim().toLowerCase())) {
            return null;
        }
        roleIds.push(item.trim().toLowerCase());
    }
    return roleIds;
}
