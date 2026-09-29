import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { ApiResponse, MatrixToggleRequest } from "@/types/api";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { invalidateRolePermissionCache } from "@/services/permission-cache";

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
        await requirePermission("admin.matrix:read");

        const roles = await db.query(`
            SELECT id, name, description
            FROM roles
            WHERE is_superuser = false
            ORDER BY name ASC
        `);

        const permissions = await db.query<{
            id: number;
            code: string;
            description: string | null;
        }>(
            `
            SELECT id, code, description
            FROM permissions
            WHERE code = ANY($1::text[])
            ORDER BY code ASC
            `,
            [PERMISSION_CATALOG.map((item) => item.code)]
        );

        const titleByCode = new Map(PERMISSION_CATALOG.map((item) => [item.code, item.title]));

        const relations = await db.query(`
            SELECT role_id, permission_id FROM role_permissions
        `);

        return NextResponse.json({
            success: true,
            data: {
                roles,
                permissions: permissions.map((permission) => ({
                    id: permission.id,
                    code: permission.code,
                    title: titleByCode.get(permission.code) ?? permission.code,
                    description: permission.description,
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

export async function POST(
    request: Request
): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
    try {
        await requirePermission("admin.matrix:write");

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

        invalidateRolePermissionCache(roleId);
        return NextResponse.json({ success: true, data: { updated: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось обновить права доступа", 500);
    }
}
