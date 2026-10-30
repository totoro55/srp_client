import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import { createErrorResponse } from '@/lib/api-error';
import { ApiResponse } from '@/types/api';
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";

export interface AvailablePosition {
    title: string;
    count: number;
}

export async function GET(): Promise<NextResponse<ApiResponse<AvailablePosition[]>>> {
    try {
        await requirePermission("access.read");
        const positions = await db.query<AvailablePosition>(
            `SELECT btrim(title) AS title, COUNT(*)::int AS count
             FROM employees
             WHERE NOT deleted
               AND title IS NOT NULL
               AND btrim(title) <> ''
             GROUP BY btrim(title)
             ORDER BY btrim(title) ASC`
        );

        return NextResponse.json({ success: true, data: positions });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse(
            'DATABASE_ERROR',
            'Не удалось загрузить список должностей',
            500
        );
    }
}
