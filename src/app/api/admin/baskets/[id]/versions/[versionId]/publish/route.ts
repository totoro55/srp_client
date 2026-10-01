import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { isVersionAvailability, type BasketDetails } from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { setBasketVersionStatus } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../../../../http";

interface RouteParams {
    params: Promise<{ id: string; versionId: string }>;
}

export async function POST(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const { id: rawId, versionId: rawVersionId } = await params;
        const basketId = readBasketId(rawId);
        const versionId = readBasketId(rawVersionId);
        const body = await request.json().catch(() => null);
        const status = body && typeof body === "object" ? (body as { status?: unknown }).status : undefined;
        if (!basketId || !versionId || typeof status !== "string" || !isVersionAvailability(status)) {
            return createErrorResponse("BAD_REQUEST", "Укажите состояние версии: тестовая, рабочая или архивная", 400);
        }

        const basket = await setBasketVersionStatus(basketId, versionId, status, access.username);
        const published = basket.versions.find((version) => version.id === versionId);
        await audit(
            access.username,
            "baskets.version.publish",
            `${basket.code}; v${published?.versionNo ?? versionId}`
        );
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
