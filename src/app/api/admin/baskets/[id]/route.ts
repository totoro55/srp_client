import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { parseBasketDescription, parseBasketMandatory, parseBasketName, type BasketDetails, type BasketProfileInput } from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { getBasket, updateBasket } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../http";

interface RouteParams {
    params: Promise<{ id: string }>;
}

function readProfile(body: unknown): BasketProfileInput | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const record = body as Record<string, unknown>;
    const name = parseBasketName(record.name);
    const description = parseBasketDescription(record.description);
    const mandatory = parseBasketMandatory(record.mandatory);
    if (!name || description === null || mandatory === null) {
        return null;
    }
    return { name, description, mandatory };
}

export async function GET(
    _request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        await requirePermission("baskets:read");
        const id = readBasketId((await params).id);
        if (!id) {
            return createErrorResponse("BAD_REQUEST", "Некорректная корзина", 400);
        }
        const basket = await getBasket(id);
        if (!basket) {
            return createErrorResponse("NOT_FOUND", "Корзина не найдена", 404);
        }
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}

export async function PATCH(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const id = readBasketId((await params).id);
        const input = readProfile(await request.json());
        if (!id || !input) {
            return createErrorResponse(
                "BAD_REQUEST",
                "Укажите название. Описание не длиннее 2000 символов.",
                400
            );
        }

        const basket = await updateBasket(id, input);
        await audit(access.username, "baskets.update", basket.code);
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
