import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { ApiResponse, MatrixToggleRequest } from "@/types/api";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/require-admin";

function parsePositiveInt(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

function parseCheckedFlag(body: MatrixToggleRequest): boolean | null {
    if (typeof body.checked === "boolean") return body.checked;
    if (typeof body.is_checked === "boolean") return body.is_checked;
    return null;
}

export async function GET() {
    try {
        await requireAdmin();

        const roles = await db.query(`
      SELECT id, name, description
      FROM roles
      WHERE name != 'ADMIN'
      ORDER BY name ASC
    `);

        const permissions = await db.query(`
            SELECT id, route_path, method, description
            FROM permissions
            ORDER BY route_path ASC
        `);

        const relations = await db.query(`
      SELECT role_id, permission_id FROM role_permissions
    `);

        return NextResponse.json({
            success: true,
            data: { roles, permissions, relations },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Ошибка сервера", 500);
    }
}

export async function POST(
    request: Request
): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
    try {
        await requireAdmin();

        const body = (await request.json()) as MatrixToggleRequest;
        const roleId = parsePositiveInt(body.roleId ?? body.role_id);
        const permissionId = parsePositiveInt(body.permissionId ?? body.permission_id);
        const isChecked = parseCheckedFlag(body);

        if (!roleId || !permissionId || isChecked === null) {
            return createErrorResponse("BAD_REQUEST", "Отсутствуют обязательные параметры", 400);
        }

        if (isChecked) {
            await db.query(
                "INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [roleId, permissionId]
            );
        } else {
            await db.query(
                "DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2",
                [roleId, permissionId]
            );
        }

        return NextResponse.json({ success: true, data: { updated: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось обновить права доступа", 500);
    }
}
