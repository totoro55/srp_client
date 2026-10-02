import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import type { RrsSetup } from "@/lib/rrs";
import { listConnectableBaskets, listRrsCards, listRrsTerritories } from "@/services/basket-connections";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function GET(): Promise<NextResponse<ApiResponse<RrsSetup>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const [territories, cards, baskets] = await Promise.all([
            listRrsTerritories(access),
            listRrsCards(access),
            listConnectableBaskets(),
        ]);
        const taken = new Set(cards.map((card) => card.territory.uuid));
        return NextResponse.json({
            success: true,
            data: {
                territories: territories.filter((territory) => !taken.has(territory.uuid)),
                baskets,
            },
        });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
