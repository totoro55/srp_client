import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import type { BasketDetails } from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { openBasketDraft } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../../http";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const id = readBasketId((await params).id);
        if (!id) {
            return createErrorResponse("BAD_REQUEST", "Некорректная корзина", 400);
        }

        const body = await request.json().catch(() => ({}));
        const rawSource = body && typeof body === "object" ? (body as { sourceVersionId?: unknown }).sourceVersionId : undefined;
        const sourceVersionId = typeof rawSource === "number" && Number.isInteger(rawSource) && rawSource > 0
            ? rawSource
            : null;

        const basket = await openBasketDraft(id, access.username, sourceVersionId);
        const created = basket.versions[0];
        await audit(access.username, "baskets.version.open", `${basket.code}; v${created?.versionNo ?? "?"}`);
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
