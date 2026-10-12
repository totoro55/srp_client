import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { buildRrsEditPolicy } from "@/lib/rrs-edit-window";
import type { RrsSetup } from "@/lib/rrs";
import { getAppSettings } from "@/services/app-settings";
import { listConnectableBaskets, listRrsCards, listRrsTerritories } from "@/services/basket-connections";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../http";

export async function GET(): Promise<NextResponse<ApiResponse<RrsSetup>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const [territories, cards, baskets, settings] = await Promise.all([
            listRrsTerritories(access),
            listRrsCards(access),
            listConnectableBaskets(),
            getAppSettings(),
        ]);
        const taken = new Set(cards.map((card) => card.territory.uuid));
        return NextResponse.json({
            success: true,
            data: {
                territories: territories.filter((territory) => !taken.has(territory.uuid)),
                baskets,
                editPolicy: buildRrsEditPolicy(settings.rrsEditCutoffDay),
            },
        });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}
