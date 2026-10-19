import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseTariffSaveRows } from "@/lib/tariff-calculation";
import { parseConnectionPeriod, parseTerritoryUuid } from "@/lib/rrs";
import { parseTariffWeightOverride, type TariffExceptionPage } from "@/lib/tariff-exceptions";
import { getTariffExceptions, saveTariffExceptions } from "@/services/tariff-exceptions";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<TariffExceptionPage>>> {
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
        const page = await getTariffExceptions(access, territoryUuid, period);
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
        const body = await request.json() as { period?: unknown; rows?: unknown; weights?: unknown };
        const period = parseConnectionPeriod(body.period);
        const rows = parseTariffSaveRows(body.rows);
        const weights = parseTariffWeightOverride(body.weights);
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период и исключения" },
            }, { status: 400 });
        }
        if ("error" in rows) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: rows.error },
            }, { status: 400 });
        }
        if (weights && "error" in weights) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: weights.error },
            }, { status: 400 });
        }
        await saveTariffExceptions(access, territoryUuid, period, rows, weights);
        return NextResponse.json({ success: true, data: { saved: true } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
