import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { adminAuthErrorResponse, requireActorFullAccess } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";
import { getAppSettings } from "@/services/app-settings";
import { clearImpersonationCookies, setImpersonationCookies } from "@/services/impersonation";
import { audit } from "@/server/authz/resolve-access";

function parsePositiveInt(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

export async function POST(request: Request) {
    try {
        const actor = await requireActorFullAccess();
        const body = (await request.json()) as { roleId?: unknown; reset?: unknown };
        const response = NextResponse.json({ success: true });

        if (body.reset === true) {
            clearImpersonationCookies(response);
            await audit(actor.username, "preview.stop", "");
            return response;
        }

        const settings = await getAppSettings();
        if (!settings.rolePreviewEnabled) {
            return createErrorResponse("FORBIDDEN", "Просмотр от имени роли выключен", 403);
        }

        const roleId = parsePositiveInt(body.roleId);
        if (!roleId) {
            return createErrorResponse("BAD_REQUEST", "Некорректный идентификатор роли", 400);
        }

        const roles = await db.query<{ id: number; name: string; is_system: boolean }>(
            "SELECT id, name, is_system FROM roles WHERE id = $1",
            [roleId]
        );
        const role = roles[0];
        if (!role || role.is_system) {
            return createErrorResponse("BAD_REQUEST", "Эту роль нельзя открыть для просмотра", 400);
        }

        setImpersonationCookies(response, role.id);
        await audit(actor.username, "preview.start", role.name);
        return response;
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Ошибка сервера", 500);
    }
}
