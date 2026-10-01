import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import {
    parseVersionComment,
    parseVersionName,
    parseVersionParameters,
    type BasketDetails,
    type BasketVersionDraftInput,
} from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { deleteBasketDraft, updateBasketVersion } from "@/services/baskets";
import { ApiResponse } from "@/types/api";
import { basketErrorResponse, readBasketId } from "../../../http";

interface RouteParams {
    params: Promise<{ id: string; versionId: string }>;
}

function readDraft(body: unknown): BasketVersionDraftInput | { error: string } {
    if (!body || typeof body !== "object") {
        return { error: "Проверьте название версии, комментарий и параметры" };
    }
    const record = body as Record<string, unknown>;
    const name = parseVersionName(record.name);
    if (!name) {
        return { error: "Укажите название версии, не длиннее 255 символов" };
    }
    const comment = parseVersionComment(record.comment);
    if (!comment) {
        return { error: "Напишите комментарий: что изменилось и зачем. Не длиннее 2000 символов" };
    }
    const settings = record.settings;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        return { error: "Проверьте параметры версии" };
    }
    const parsed = parseVersionParameters((settings as { parameters?: unknown }).parameters);
    if ("error" in parsed) {
        return parsed;
    }
    return { name, comment, settings: { parameters: parsed.parameters } };
}

export async function PATCH(
    request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const { id: rawId, versionId: rawVersionId } = await params;
        const basketId = readBasketId(rawId);
        const versionId = readBasketId(rawVersionId);
        const input = readDraft(await request.json());
        if (!basketId || !versionId) {
            return createErrorResponse("BAD_REQUEST", "Некорректная версия", 400);
        }
        if ("error" in input) {
            return createErrorResponse("BAD_REQUEST", input.error, 400);
        }

        const basket = await updateBasketVersion(basketId, versionId, input, access.username);
        await audit(access.username, "baskets.version.update", `${basket.code}; version ${versionId}`);
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}

export async function DELETE(
    _request: Request,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<BasketDetails>>> {
    try {
        const access = await requirePermission("baskets:write");
        const { id: rawId, versionId: rawVersionId } = await params;
        const basketId = readBasketId(rawId);
        const versionId = readBasketId(rawVersionId);
        if (!basketId || !versionId) {
            return createErrorResponse("BAD_REQUEST", "Некорректная версия", 400);
        }

        const basket = await deleteBasketDraft(basketId, versionId);
        await audit(access.username, "baskets.version.delete", `${basket.code}; version ${versionId}`);
        return NextResponse.json({ success: true, data: basket });
    } catch (error) {
        return basketErrorResponse(error);
    }
}
