import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import {
    isBasketSettingsSchema,
    parseBasketCode,
    parseBasketDescription,
    parseBasketMandatory,
    parseBasketName,
    type BasketDraftInput,
    type BasketSettingsSchema,
    type BasketSummary,
} from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { createBasket, listBaskets } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse } from "./http";

function readCreateBody(body: unknown): BasketDraftInput | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const record = body as Record<string, unknown>;
    const code = parseBasketCode(record.code);
    const name = parseBasketName(record.name);
    const description = parseBasketDescription(record.description);
    const indicatorId = typeof record.indicatorId === "number" ? record.indicatorId : Number.NaN;
    const requestedSchema = record.settingsSchema === undefined ? "tariff" : record.settingsSchema;
    const settingsSchema: BasketSettingsSchema | null = typeof requestedSchema === "string" && isBasketSettingsSchema(requestedSchema)
        ? requestedSchema
        : null;
    const mandatory = record.mandatory === undefined ? true : parseBasketMandatory(record.mandatory);
    if (!code || !name || description === null || mandatory === null || !Number.isInteger(indicatorId) || indicatorId <= 0 || !settingsSchema) {
        return null;
    }
    return { code, name, description, indicatorId, settingsSchema, mandatory };
}

export async function GET(): Promise<NextResponse<ApiResponse<BasketSummary[]>>> {
    try {
        await requirePermission("baskets:read");
        const baskets = await listBaskets();
        return NextResponse.json({ success: true, data: baskets });
    } catch (error) {
        return basketErrorResponse(error);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ id: number }>>> {
    try {
        const access = await requirePermission("baskets:write");
        const input = readCreateBody(await request.json());
        if (!input) {
            return createErrorResponse(
                "BAD_REQUEST",
                "Укажите код латиницей, название и показатель. Описание не длиннее 2000 символов.",
                400
            );
        }

        const basket = await createBasket(input, access.username);
        await audit(access.username, "baskets.create", `${basket.code}; ${basket.indicatorName}; ${basket.settingsSchema}`);
        return NextResponse.json({ success: true, data: { id: basket.id } });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
