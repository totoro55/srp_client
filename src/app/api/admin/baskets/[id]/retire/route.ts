import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import type { BasketDetails } from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { retireBasket } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../../http";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    _request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const id = readBasketId((await params).id);
        if (!id) {
            return createErrorResponse("BAD_REQUEST", "Некорректная корзина", 400);
        }

        const basket = await retireBasket(id);
        await audit(access.username, "baskets.retire", basket.code);
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
