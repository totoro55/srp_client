import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { parseConnectionPeriod, parseRrsSaveInput, parseTerritoryUuid, type RrsMonthState } from "@/lib/rrs";
import { getRrsMonth, saveRrsMonth } from "@/services/basket-connections";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<RrsMonthState>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const url = new URL(request.url);
        const territoryUuid = parseTerritoryUuid(url.searchParams.get("territoryUuid"));
        const period = parseConnectionPeriod(url.searchParams.get("period"));
        if (!territoryUuid || !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Укажите РРС и месяц" },
            }, { status: 400 });
        }
        const data = await getRrsMonth(access, territoryUuid, period);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<{ saved: true }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const input = parseRrsSaveInput(await request.json());
        if (!input) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте РРС, месяц и набор корзин" },
            }, { status: 400 });
        }
        await saveRrsMonth(access, input.territoryUuid, input.period, input.items);
        await audit(access.username, "rrs.connections.save", `${input.territoryUuid}; ${input.period}`);
        return NextResponse.json({ success: true, data: { saved: true } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
