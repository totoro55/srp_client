import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid } from "@/lib/rrs";
import { parseTariffExceptionItems, type TariffExceptionReport } from "@/lib/tariff-exceptions";
import { getEnabledTariffExceptions, saveExceptionRules } from "@/services/tariff-exceptions";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<TariffExceptionReport>>> {
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
        const report = await getEnabledTariffExceptions(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: report });
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
        const items = parseTariffExceptionItems(body.items);
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период и исключения" },
            }, { status: 400 });
        }
        if ("error" in items) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: items.error },
            }, { status: 400 });
        }
        await saveExceptionRules(access, territoryUuid, period, items);
        return NextResponse.json({ success: true, data: { saved: true } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
