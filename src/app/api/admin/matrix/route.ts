import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { isPermissionCode, PERMISSION_CATALOG } from "@/lib/permissions";
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

        const roles = await db.query(`
            SELECT id, code, name, description, scope_kind AS "scopeKind", is_system AS "isSystem"
            FROM roles
            ORDER BY is_system DESC, name ASC
        `);

        const relations = await db.query<{ role_id: number; permission_code: string }>(
            "SELECT role_id, permission_code FROM role_permission_codes"
        );

        return NextResponse.json({
            success: true,
            data: {
                roles,
                permissions: PERMISSION_CATALOG.map((item) => ({
                    code: item.code,
                    group: item.group,
                    title: item.title,
                    description: item.description,
                })),
                relations,
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Ошибка сервера", 500);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const body = (await request.json()) as {
            roleId?: unknown;
            permissionCode?: unknown;
            checked?: unknown;
        };

        const roleId = parsePositiveInt(body.roleId);
        const permissionCode = typeof body.permissionCode === "string" ? body.permissionCode : "";
        const checked = body.checked;

        if (!roleId || !isPermissionCode(permissionCode) || typeof checked !== "boolean") {
            return createErrorResponse("BAD_REQUEST", "Отсутствуют обязательные параметры", 400);
        }

        const roles = await db.query<{ is_system: boolean; name: string }>(
            "SELECT is_system, name FROM roles WHERE id = $1",
            [roleId]
        );
        const role = roles[0];
        if (!role) {
            return createErrorResponse("BAD_REQUEST", "Роль не найдена", 400);
        }
        if (role.is_system) {
            return createErrorResponse("BAD_REQUEST", "Права администратора не изменяются", 400);
        }

        if (checked) {
            await db.query(
                "INSERT INTO role_permission_codes (role_id, permission_code) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [roleId, permissionCode]
            );
        } else {
            await db.query(
                "DELETE FROM role_permission_codes WHERE role_id = $1 AND permission_code = $2",
                [roleId, permissionCode]
            );
        }

        await audit(
            access.username,
            "matrix.toggle",
            `${role.name}: ${permissionCode} ${checked ? "включено" : "снято"}`
        );

        return NextResponse.json({ success: true, data: { updated: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось обновить права доступа", 500);
    }
}
