import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import { adminAuthErrorResponse, requireAdmin } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";

interface RolePermissionToggleBody {
    role_id?: unknown;
    permission_id?: unknown;
    is_enabled?: unknown;
}

function parsePositiveInt(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

export async function POST(request: Request) {
    try {
        await requireAdmin();
        const body = (await request.json()) as RolePermissionToggleBody;
        const roleId = parsePositiveInt(body.role_id);
        const permissionId = parsePositiveInt(body.permission_id);

        if (!roleId || !permissionId || typeof body.is_enabled !== "boolean") {
            return createErrorResponse("BAD_REQUEST", "Отсутствуют обязательные параметры", 400);
        }

        if (body.is_enabled) {
            await db.query(
                `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [roleId, permissionId]
            );
        } else {
            await db.query(
                `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
                [roleId, permissionId]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Ошибка сервера", 500);
    }
}
