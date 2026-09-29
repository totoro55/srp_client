import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { ApiResponse, Permission } from "@/types/api";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { PERMISSION_CATALOG } from "@/lib/permissions";

export async function GET(): Promise<NextResponse<ApiResponse<Permission[]>>> {
    try {
        await requirePermission("admin.catalog:read");
        const rows = await db.query<{ id: number; code: string; description: string | null }>(
            `
            SELECT id, code, description
            FROM permissions
            WHERE code = ANY($1::text[])
            ORDER BY code ASC
            `,
            [PERMISSION_CATALOG.map((item) => item.code)]
        );
        const titleByCode = new Map(PERMISSION_CATALOG.map((item) => [item.code, item.title]));
        return NextResponse.json({
            success: true,
            data: rows.map((row) => ({
                id: row.id,
                code: row.code,
                title: titleByCode.get(row.code) ?? row.code,
                description: row.description,
            })),
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse(
            "DATABASE_ERROR",
            "Не удалось загрузить каталог прав",
            500
        );
    }
}
