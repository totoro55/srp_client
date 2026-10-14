import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid, type RrsMotivationItem, type RrsMotivationPage } from "@/lib/rrs";
import { getBranchMotivation, saveBranchMotivation } from "@/services/branch-motivation";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<RrsMotivationPage>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        if (!territoryUuid) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Некорректная территория" },
            }, { status: 400 });
        }
        const periodParam = request.nextUrl.searchParams.get("period");
        const period = periodParam === null ? null : parseConnectionPeriod(periodParam);
        if (periodParam !== null && !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Некорректный период" },
            }, { status: 400 });
        }
        const page = await getBranchMotivation(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<{ saved: true }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        const body = await request.json() as { period?: unknown; items?: unknown };
        const period = parseConnectionPeriod(body.period);
        const items = readItems(body.items);
        if (!territoryUuid || !period || !items) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период и участие филиалов" },
            }, { status: 400 });
        }
        await saveBranchMotivation(access, territoryUuid, period, items);
        return NextResponse.json({ success: true, data: { saved: true } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

function readItems(value: unknown): RrsMotivationItem[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const items: RrsMotivationItem[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return null;
        }
        const record = item as Record<string, unknown>;
        if (typeof record.branchUuid !== "string" || typeof record.enabled !== "boolean") {
            return null;
        }
        items.push({ branchUuid: record.branchUuid, enabled: record.enabled });
    }
    return items;
}
