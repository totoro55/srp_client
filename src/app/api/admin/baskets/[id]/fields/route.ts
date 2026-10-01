import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { isBasketSettingsSchema, type BasketDetails } from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { updateBasketSettingsSchema } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../../http";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function PATCH(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const id = readBasketId((await params).id);
        const body = await request.json();
        const settingsSchema = body && typeof body === "object"
            ? (body as { settingsSchema?: unknown }).settingsSchema
            : "";
        if (!id || typeof settingsSchema !== "string" || !isBasketSettingsSchema(settingsSchema)) {
            return createErrorResponse("BAD_REQUEST", "Выберите набор полей версии", 400);
        }

        const basket = await updateBasketSettingsSchema(id, settingsSchema);
        await audit(access.username, "baskets.fields", `${basket.code}; ${basket.settingsSchema}`);
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
