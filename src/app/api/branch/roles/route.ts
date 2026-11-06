import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { isStaffPeriod, readBranchStaff } from "@/services/branch-staff";
import { MotivationSettingsError, saveBranchRoleOverrides } from "@/services/motivation-roles";
import type { ApiResponse } from "@/types/api";

const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BranchRolesPayload {
    saved: true;
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
        await saveBranchRoleOverrides(branchId, overrides);
        return NextResponse.json({ success: true, data: { saved: true } });
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
