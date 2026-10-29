import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseTariffReference } from "@/lib/tariff-calculation";
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
        const body = await readBody(request);
        if (!territoryUuid || !body.period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период" },
            }, { status: 400 });
        }
        if (body.referenceError) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: body.referenceError },
            }, { status: 400 });
        }
        const rows = await previewRecalculatedTariffs(access, territoryUuid, body.period, body.reference);
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
        const body = await readBody(request);
        if (!territoryUuid || !body.period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период" },
            }, { status: 400 });
        }
        if (body.referenceError) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: body.referenceError },
            }, { status: 400 });
        }
        const saved = await saveRecalculatedTariffs(access, territoryUuid, body.period, body.reference);
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

async function territoryOf(params: Promise<{ territoryUuid: string }>): Promise<string | null> {
    const { territoryUuid } = await params;
    return parseTerritoryUuid(territoryUuid);
}

async function readBody(request: NextRequest): Promise<{ period: string | null; reference?: "mean" | "median" | "trimmed" | "priceAdjusted"; referenceError?: string }> {
    const body = await request.json() as { period?: unknown; reference?: unknown };
    const reference = parseTariffReference(body.reference);
    if (typeof reference !== "string") {
        return { period: parseConnectionPeriod(body.period), referenceError: reference.error };
    }
    return { period: parseConnectionPeriod(body.period), reference: body.reference === undefined ? undefined : reference };
}
