import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid } from "@/lib/rrs";
import type { CalculatedTariffRow } from "@/lib/tariff-exceptions";
import { previewRecalculatedTariffs, saveRecalculatedTariffs } from "@/services/tariff-exceptions";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<CalculatedTariffRow[]>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const territoryUuid = await territoryOf(context.params);
        const period = await periodOf(request);
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период" },
            }, { status: 400 });
        }
        const rows = await previewRecalculatedTariffs(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<{ saved: number }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const territoryUuid = await territoryOf(context.params);
        const period = await periodOf(request);
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период" },
            }, { status: 400 });
        }
        const saved = await saveRecalculatedTariffs(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

async function territoryOf(params: Promise<{ territoryUuid: string }>): Promise<string | null> {
    const { territoryUuid } = await params;
    return parseTerritoryUuid(territoryUuid);
}

async function periodOf(request: NextRequest): Promise<string | null> {
    const body = await request.json() as { period?: unknown };
    return parseConnectionPeriod(body.period);
}
