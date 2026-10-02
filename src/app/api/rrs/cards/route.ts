import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import type { RrsCardSummary } from "@/lib/rrs";
import { listRrsCards } from "@/services/basket-connections";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function GET(): Promise<NextResponse<ApiResponse<RrsCardSummary[]>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const cards = await listRrsCards(access);
        return NextResponse.json({ success: true, data: cards });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
