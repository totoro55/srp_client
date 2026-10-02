import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import type { RrsTerritory } from "@/lib/rrs";
import { listRrsTerritories } from "@/services/basket-connections";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function GET(): Promise<NextResponse<ApiResponse<RrsTerritory[]>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const territories = await listRrsTerritories(access);
        return NextResponse.json({ success: true, data: territories });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
