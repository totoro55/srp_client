import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { ApiResponse } from "@/types/api";

function parsePositiveInt(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

export async function GET() {
    try {
        await requirePermission("access.read");
        const territories = await db.query("SELECT id, code, name FROM territories ORDER BY name");
        const grants = await db.query(`
            SELECT g.id, g.username, g.territory_id AS "territoryId", t.name AS "territoryName"
            FROM scope_grants g
            JOIN territories t ON t.id = g.territory_id
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
            territoryId?: unknown;
        };

        const username = typeof body.username === "string" ? body.username.trim() : "";
        const territoryId = parsePositiveInt(body.territoryId);
        if (!username || !territoryId) {
            return createErrorResponse("BAD_REQUEST", "Укажите логин и территорию", 400);
        }

        try {
            await db.query(
                "INSERT INTO scope_grants (username, territory_id) VALUES ($1, $2)",
                [username, territoryId]
            );
        } catch {
            return createErrorResponse("BAD_REQUEST", "Такое назначение уже есть", 400);
        }

        await audit(access.username, "scope.grant", `${username} → ${territoryId}`);
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
