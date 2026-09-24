import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import { createErrorResponse } from '@/lib/api-error';
import { ApiResponse } from '@/types/api';

export async function GET(): Promise<NextResponse<ApiResponse<string[]>>> {
    try {
        // Выполняем быстрый запрос к представлению в схеме public
        const positions = await db.query<{ position_name: string }>(
            'SELECT position_name FROM unique_positions WHERE position_name IS NOT NULL ORDER BY position_name ASC'
        );

        // Превращаем массив объектов [{ position_name: '...' }] в плоский массив строк
        const cleanPositions = positions.map(p => p.position_name);

        return NextResponse.json({ success: true, data: cleanPositions });
    } catch (error) {
        return createErrorResponse(
            'DATABASE_ERROR',
            'Не удалось загрузить список должностей из представления unique_positions',
            500,
            error instanceof Error ? error.message : error
        );
    }
}
