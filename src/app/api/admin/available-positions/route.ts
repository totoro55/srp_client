import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import { createErrorResponse } from '@/lib/api-error';
import { ApiResponse } from '@/types/api';
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";

export async function GET(): Promise<NextResponse<ApiResponse<string[]>>> {
    try {
        await requirePermission("access.read");
        // Выполняем быстрый запрос к представлению в схеме public
        const positions = await db.query<{ position_name: string }>(
            `SELECT DISTINCT title AS position_name
             FROM employees
             WHERE title IS NOT NULL AND btrim(title) <> ''
             ORDER BY title ASC`
        );

        // Превращаем массив объектов [{ position_name: '...' }] в плоский массив строк
        const cleanPositions = positions.map(p => p.position_name);

        return NextResponse.json({ success: true, data: cleanPositions });
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
