import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid } from "@/lib/rrs";
import type { TariffSegmentMatch } from "@/lib/tariff-exceptions";
import { searchTariffSegments } from "@/services/tariff-exceptions";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<TariffSegmentMatch[]>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        const period = parseConnectionPeriod(request.nextUrl.searchParams.get("period"));
        const query = request.nextUrl.searchParams.get("q") ?? "";
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Некорректные территория или период" },
            }, { status: 400 });
        }
        const matches = await searchTariffSegments(access, territoryUuid, period, query);
        return NextResponse.json({ success: true, data: matches });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
