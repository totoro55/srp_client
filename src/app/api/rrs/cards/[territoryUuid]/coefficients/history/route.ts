import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid, type RrsFieldChangeEvent } from "@/lib/rrs";
import { listCoefficientHistory } from "@/services/basket-coefficients";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<RrsFieldChangeEvent[]>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        const period = parseConnectionPeriod(request.nextUrl.searchParams.get("period"));
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте территорию и период" },
            }, { status: 400 });
        }
        const history = await listCoefficientHistory(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: history });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
