import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseTerritoryUuid, type RrsHistoryEvent } from "@/lib/rrs";
import { listRrsHistory } from "@/services/basket-connections";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    _request: Request,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<RrsHistoryEvent[]>>> {
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
        const history = await listRrsHistory(access, territoryUuid);
        return NextResponse.json({ success: true, data: history });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
