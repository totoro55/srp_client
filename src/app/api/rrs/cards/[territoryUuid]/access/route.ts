import { NextResponse } from "next/server";
import { grantErrorResponse } from "@/app/api/rrs/grant-http";
import type { ManagerAccessPage, ManagerGrantDraft } from "@/lib/manager-grants";
import { requirePermission } from "@/lib/require-admin";
import { parseTerritoryUuid } from "@/lib/rrs";
import { readManagerAccess, saveManagerAccess } from "@/services/manager-branch-grants";
import type { ApiResponse } from "@/types/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
    _request: Request,
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
        const page = await readManagerAccess(access, territoryUuid);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return grantErrorResponse(error, "Не удалось прочитать выдачу доступа");
    }
}

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
        const body = await request.json() as { employeeId?: unknown; branches?: unknown };
        const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
        const branches = readDrafts(body.branches);
        if (!UUID.test(employeeId) || !branches) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Укажите управляющего и филиалы" },
            }, { status: 400 });
        }
        const page = await saveManagerAccess(access, territoryUuid, employeeId, branches);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return grantErrorResponse(error, "Не удалось сохранить выдачу доступа");
    }
}

function readDrafts(value: unknown): ManagerGrantDraft[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const drafts: ManagerGrantDraft[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return null;
        }
        const row = item as Record<string, unknown>;
        const id = typeof row.id === "string" ? row.id : "";
        if (!UUID.test(id) || typeof row.access !== "boolean" || typeof row.roles !== "boolean" || typeof row.brigades !== "boolean" || typeof row.shared !== "boolean") {
            return null;
        }
        drafts.push({
            id: id.toLowerCase(),
            access: row.access,
            roles: row.roles,
            brigades: row.brigades,
            shared: row.shared,
        });
    }
    return drafts;
}
