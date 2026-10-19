import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid } from "@/lib/rrs";
import type { TariffPremiumPage } from "@/lib/tariff-premium";
import { getTariffPremium } from "@/services/tariff-premium";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<TariffPremiumPage>>> {
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
        const page = await getTariffPremium(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
