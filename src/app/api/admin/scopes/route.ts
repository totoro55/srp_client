import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { ApiResponse } from "@/types/api";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUuid(value: unknown): string | null {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
        return null;
    }
    return value;
}

export async function GET() {
    try {
        await requirePermission("access.read");
        const territories = await db.query("SELECT uuid, code, name FROM territories ORDER BY name");
        const grants = await db.query(`
            SELECT g.id, g.username, g.territory_uuid AS "territoryUuid", t.name AS "territoryName"
            FROM scope_grants g
            JOIN territories t ON t.uuid = g.territory_uuid
            ORDER BY g.username, t.name
        `);
        return NextResponse.json({ success: true, data: { territories, grants } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить области", 500);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ created: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const body = (await request.json()) as {
            username?: unknown;
            territoryUuid?: unknown;
        };

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const territoryUuid = parseUuid(body.territoryUuid);
        if (!username || !territoryUuid) {
            return createErrorResponse("BAD_REQUEST", "Укажите логин и территорию", 400);
        }

        try {
            await db.query(
                "INSERT INTO scope_grants (username, territory_uuid) VALUES ($1, $2)",
                [username, territoryUuid]
            );
        } catch {
            return createErrorResponse("BAD_REQUEST", "Такое назначение уже есть", 400);
        }

        await audit(access.username, "scope.grant", `${username} → ${territoryUuid}`);
        return NextResponse.json({ success: true, data: { created: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить область", 500);
    }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const grantId = Number(new URL(request.url).searchParams.get("grantId"));

        if (!Number.isInteger(grantId) || grantId <= 0) {
            return createErrorResponse("BAD_REQUEST", "Нечего удалять", 400);
        }

        await db.query("DELETE FROM scope_grants WHERE id = $1", [grantId]);
        await audit(access.username, "scope.revoke", String(grantId));
        return NextResponse.json({ success: true, data: { deleted: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось удалить запись", 500);
    }
}
