import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseTerritoryUuid, type RrsReadiness } from "@/lib/rrs";
import { getRrsReadiness } from "@/services/rrs-readiness";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    _request: Request,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<RrsReadiness>>> {
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
        const readiness = await getRrsReadiness(access, territoryUuid);
        return NextResponse.json({ success: true, data: readiness });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
