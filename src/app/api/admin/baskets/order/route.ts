import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { reorderBaskets } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse } from "../http";

function readIds(body: unknown): number[] | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const ids = (body as { ids?: unknown }).ids;
    if (!Array.isArray(ids) || ids.some((id) => !Number.isInteger(id) || (id as number) <= 0)) {
        return null;
    }
    return ids as number[];
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<{ ids: number[] }>>> {
    try {
        const access = await requirePermission("baskets:write");
        const ids = readIds(await request.json());
        if (!ids) {
            return createErrorResponse("BAD_REQUEST", "Передайте порядок корзин", 400);
        }
        await reorderBaskets(ids);
        await audit(access.username, "baskets.reorder", ids.join(","));
        return NextResponse.json({ success: true, data: { ids } });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
