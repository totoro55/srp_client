import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import {ApiErrorResponse} from "@/types/api";

export async function POST(request: Request) {
    try {
        const { role_id, permission_id, is_enabled } = await request.json();

        if (is_enabled) {
            // Админ поставил галочку — добавляем связь
            await db.query(
                `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [role_id, permission_id]
            );
        } else {
            // Админ убрал галочку — удаляем связь
            await db.query(
                `DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2`,
                [role_id, permission_id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
    }
}
