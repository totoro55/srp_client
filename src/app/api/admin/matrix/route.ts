// src/app/api/admin/matrix/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/services/db';

import { ApiResponse} from '@/types/api';
import {createErrorResponse} from "@/lib/api-error";

export async function GET() {
    try {
        // Исключаем ADMIN из выборки для матрицы прав
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
            data: { roles, permissions, relations }
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500 });
    }
}

// Изменение состояния чекбокса (Связывание / Разрыв связи)
export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
    try {
        const { role_id, permission_id, is_checked } = await request.json() as {
            role_id: number;
            permission_id: number;
            is_checked: boolean;
        };

        if (!role_id || !permission_id) {
            return createErrorResponse('BAD_REQUEST', 'Отсутствуют обязательные параметры', 400);
        }

        if (is_checked) {
            await db.query(
                'INSERT INTO role_permissions (role_id, permission_id) VALUES (\$1, \$2) ON CONFLICT DO NOTHING',
                [role_id, permission_id]
            );
        } else {
            await db.query(
                'DELETE FROM role_permissions WHERE role_id = \$1 AND permission_id = \$2',
                [role_id, permission_id]
            );
        }

        return NextResponse.json({ success: true, data: { updated: true } });
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Не удалось обновить права доступа', 500, error);
    }
}
