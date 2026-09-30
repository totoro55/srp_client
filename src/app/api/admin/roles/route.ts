import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { isScopeKind } from "@/lib/permissions";
import { audit } from "@/server/authz/resolve-access";
import { ApiResponse } from "@/types/api";

export async function GET() {
    try {
        await requirePermission("access.read");
        const roles = await db.query(`
            SELECT id, code, name, description, scope_kind AS "scopeKind", is_system AS "isSystem"
            FROM roles
            ORDER BY name
        `);
        return NextResponse.json({ success: true, data: roles });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить роли", 500);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ created: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const body = (await request.json()) as {
            name?: unknown;
            code?: unknown;
            scopeKind?: unknown;
            description?: unknown;
        };

        const name = typeof body.name === "string" ? body.name.trim() : "";
        const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
        const scopeKind = typeof body.scopeKind === "string" ? body.scopeKind : "";
        const description = typeof body.description === "string" ? body.description.trim() : "";

        if (!name || !/^[a-z][a-z0-9_]{1,40}$/.test(code) || !isScopeKind(scopeKind)) {
            return createErrorResponse("BAD_REQUEST", "Укажите название, код латиницей и вид области", 400);
        }

        if (code === "admin") {
            return createErrorResponse("BAD_REQUEST", "Код admin занят системной ролью", 400);
        }

        try {
            await db.query(
                "INSERT INTO roles (name, code, description, scope_kind, is_system) VALUES ($1, $2, $3, $4, false)",
                [name, code, description || null, scopeKind]
            );
        } catch {
            return createErrorResponse("BAD_REQUEST", "Роль с таким кодом уже есть", 400);
        }

        await audit(access.username, "role.create", `${code} / ${scopeKind}`);
        return NextResponse.json({ success: true, data: { created: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось создать роль", 500);
    }
}

export async function PATCH(request: Request): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const body = (await request.json()) as {
            id?: unknown;
            name?: unknown;
            scopeKind?: unknown;
            description?: unknown;
        };

        const id = typeof body.id === "number" ? body.id : Number(body.id);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const scopeKind = typeof body.scopeKind === "string" ? body.scopeKind : "";
        const description = typeof body.description === "string" ? body.description.trim() : "";

        if (!Number.isInteger(id) || id <= 0 || !name || !isScopeKind(scopeKind)) {
            return createErrorResponse("BAD_REQUEST", "Укажите роль, название и вид области", 400);
        }

        const roles = await db.query<{ is_system: boolean; code: string }>(
            "SELECT is_system, code FROM roles WHERE id = $1",
            [id]
        );
        const role = roles[0];
        if (!role) {
            return createErrorResponse("NOT_FOUND", "Роль не найдена", 404);
        }
        if (role.is_system && scopeKind !== "division") {
            return createErrorResponse("BAD_REQUEST", "У администратора область всегда дивизион", 400);
        }

        await db.query(
            "UPDATE roles SET name = $1, description = $2, scope_kind = $3 WHERE id = $4",
            [name, description || null, scopeKind, id]
        );
        await audit(access.username, "role.update", `${role.code} / ${scopeKind}`);
        return NextResponse.json({ success: true, data: { updated: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось изменить роль", 500);
    }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const id = Number(new URL(request.url).searchParams.get("id"));
        if (!Number.isInteger(id) || id <= 0) {
            return createErrorResponse("BAD_REQUEST", "Некорректный идентификатор роли", 400);
        }

        const roles = await db.query<{ is_system: boolean; code: string }>(
            "SELECT is_system, code FROM roles WHERE id = $1",
            [id]
        );
        const role = roles[0];
        if (!role) {
            return createErrorResponse("NOT_FOUND", "Роль не найдена", 404);
        }
        if (role.is_system) {
            return createErrorResponse("BAD_REQUEST", "Системную роль нельзя удалить", 400);
        }

        const rules = await db.query<{ id: number }>("SELECT id FROM role_rules WHERE role_id = $1 LIMIT 1", [id]);
        if (rules.length > 0) {
            return createErrorResponse("BAD_REQUEST", "Сначала удалите правила трансляции этой роли", 400);
        }

        await db.query("DELETE FROM roles WHERE id = $1", [id]);
        await audit(access.username, "role.delete", role.code);
        return NextResponse.json({ success: true, data: { deleted: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось удалить роль", 500);
    }
}
