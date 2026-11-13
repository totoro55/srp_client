import { NextResponse } from "next/server";
import { grantErrorResponse } from "@/app/api/rrs/grant-http";
import type { ManagerAccessPage, ManagerGrantPolicies, ManagerGrantPolicy, ManagerTitleGroup } from "@/lib/manager-grants";
import { requirePermission } from "@/lib/require-admin";
import { parseTerritoryUuid } from "@/lib/rrs";
import { saveManagerGrantPolicy } from "@/services/manager-branch-grants";
import type { ApiResponse } from "@/types/api";

const GROUPS = ["manager", "deputy", "senior"] as const satisfies readonly ManagerTitleGroup[];

export async function PUT(
    request: Request,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<ManagerAccessPage>>> {
    try {
        const access = await requirePermission("branch.grants:write");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        if (!territoryUuid) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Некорректная территория" },
            }, { status: 400 });
        }
        const policies = readPolicies(await request.json());
        if (!policies) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Укажите общую выдачу" },
            }, { status: 400 });
        }
        const page = await saveManagerGrantPolicy(access, territoryUuid, policies);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return grantErrorResponse(error, "Не удалось сохранить общую выдачу");
    }
}

function readPolicies(value: unknown): ManagerGrantPolicies | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const body = value as Record<string, unknown>;
    const policies = {} as ManagerGrantPolicies;
    for (const group of GROUPS) {
        const policy = readPolicy(body[group]);
        if (!policy) {
            return null;
        }
        policies[group] = policy;
    }
    return policies;
}

function readPolicy(value: unknown): ManagerGrantPolicy | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const body = value as Record<string, unknown>;
    if (typeof body.access !== "boolean" || typeof body.roles !== "boolean" || typeof body.brigades !== "boolean" || typeof body.shared !== "boolean") {
        return null;
    }
    return {
        access: body.access,
        roles: body.roles,
        brigades: body.brigades,
        shared: body.shared,
    };
}
