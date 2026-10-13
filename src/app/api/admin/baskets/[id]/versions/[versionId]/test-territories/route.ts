import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { type BasketTestTerritorySettings } from "@/lib/baskets";
import { parseTerritoryUuid } from "@/lib/rrs";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { getVersionTestTerritories, replaceVersionTestTerritories } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../../../../http";

interface RouteParams {
    params: Promise<{ id: string; versionId: string }>;
}

function readTerritoryUuids(body: unknown): string[] | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const record = body as Record<string, unknown>;
    if (!Array.isArray(record.territoryUuids)) {
        return null;
    }
    const uuids: string[] = [];
    for (const value of record.territoryUuids) {
        const uuid = parseTerritoryUuid(value);
        if (!uuid) {
            return null;
        }
        uuids.push(uuid);
    }
    return uuids;
}

export async function GET(
    _request: Request,
    { params }: RouteParams,
): Promise<NextResponse<ApiResponse<BasketTestTerritorySettings>>> {
    try {
        await requirePermission("baskets:read");
        const { id: rawId, versionId: rawVersionId } = await params;
        const id = readBasketId(rawId);
        const versionId = readBasketId(rawVersionId);
        if (!id || !versionId) {
            return createErrorResponse("BAD_REQUEST", "Некорректная версия", 400);
        }
        const settings = await getVersionTestTerritories(id, versionId);
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        return basketErrorResponse(error);
    }
}

export async function PUT(
    request: Request,
    { params }: RouteParams,
): Promise<NextResponse<ApiResponse<BasketTestTerritorySettings>>> {
    try {
        const access = await requirePermission("baskets:write");
        const { id: rawId, versionId: rawVersionId } = await params;
        const id = readBasketId(rawId);
        const versionId = readBasketId(rawVersionId);
        const territoryUuids = readTerritoryUuids(await request.json());
        if (!id || !versionId || !territoryUuids) {
            return createErrorResponse("BAD_REQUEST", "Выберите территории из списка", 400);
        }
        const settings = await replaceVersionTestTerritories(id, versionId, territoryUuids);
        await audit(access.username, "baskets.version-test-territories", `${id}; ${versionId}; ${settings.selected.length}`);
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
