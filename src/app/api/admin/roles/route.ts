import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import {createErrorResponse} from "@/lib/api-error";

// 1. Получение списков ролей, маппингов должностей и исключений
export async function GET() {
    try {
        const roles = await db.query('SELECT * FROM roles ORDER BY id ASC');
        const mappings = await db.query(`
      SELECT m.id, m.ldap_position, r.name as role_name, m.role_id 
      FROM ldap_position_mappings m 
      JOIN roles r ON m.role_id = r.id 
      ORDER BY m.id DESC
    `);
        const exceptions = await db.query(`
      SELECT e.id, e.username, r.name as role_name, e.role_id, e.reason 
      FROM user_role_exceptions e 
      JOIN roles r ON e.role_id = r.id 
      ORDER BY e.id DESC
    `);

        return NextResponse.json({ success: true, data: { roles, mappings, exceptions } });
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Не удалось загрузить списки управления', 500, error);
    }
}

// 2. Создание новой роли, маппинга или исключения
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, role_name, description, ldap_position, role_id, username, reason } = body;

        // Создание роли
        if (type === 'ROLE') {
            if (!role_name) return createErrorResponse('BAD_REQUEST', 'Имя роли обязательно', 400);
            const res = await db.query(
                'INSERT INTO roles (name, description) VALUES (\$1, \$2) ON CONFLICT (name) DO NOTHING RETURNING id',
                [role_name.toUpperCase(), description]
            );
            return NextResponse.json({ success: true, data: res });
        }

        // Создание маппинга должности LDAP -> Роль
        if (type === 'MAPPING') {
            if (!ldap_position || !role_id) return createErrorResponse('BAD_REQUEST', 'Должность и роль обязательны', 400);
            const res = await db.query(
                'INSERT INTO ldap_position_mappings (ldap_position, role_id) VALUES (\$1, \$2) ON CONFLICT (ldap_position) DO UPDATE SET role_id = EXCLUDED.role_id RETURNING id',
                [ldap_position, role_id]
            );
            return NextResponse.json({ success: true, data: res });
        }

        // Создание исключения для пользователя
        if (type === 'EXCEPTION') {
            if (!username || !role_id) return createErrorResponse('BAD_REQUEST', 'Логин и роль обязательны', 400);
            const res = await db.query(
                'INSERT INTO user_role_exceptions (username, role_id, reason) VALUES (\$1, \$2, \$3) ON CONFLICT (username) DO UPDATE SET role_id = EXCLUDED.role_id, reason = EXCLUDED.reason RETURNING id',
                [username, role_id, reason]
            );
            return NextResponse.json({ success: true, data: res });
        }

        return createErrorResponse('BAD_REQUEST', 'Неверный тип операции', 400);
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Ошибка при сохранении данных', 500, error);
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const type = searchParams.get('type'); // 'ROLE' | 'MAPPING' | 'EXCEPTION'

        if (!id || !type) return createErrorResponse('BAD_REQUEST', 'Параметры id и type обязательны', 400);

        const intId = parseInt(id, 10);

        if (type === 'ROLE') await db.query('DELETE FROM roles WHERE id = $1', [intId]);
        if (type === 'MAPPING') await db.query('DELETE FROM ldap_position_mappings WHERE id = $1', [intId]);
        if (type === 'EXCEPTION') await db.query('DELETE FROM user_role_exceptions WHERE id = $1', [intId]);

        return NextResponse.json({ success: true });
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Не удалось удалить запись', 500, error);
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { type, id, ...payload } = body;

        if (!id || !type) return createErrorResponse('BAD_REQUEST', 'ID и тип операции обязательны', 400);
        const intId = parseInt(id, 10);

        if (type === 'ROLE') {
            await db.query('UPDATE roles SET name = $1, description = $2 WHERE id = $3', [payload.role_name.toUpperCase(), payload.description || null, intId]);
        }
        if (type === 'MAPPING') {
            await db.query('UPDATE ldap_position_mappings SET ldap_position = $1, role_id = $2 WHERE id = $3', [payload.ldap_position, payload.role_id, intId]);
        }
        if (type === 'EXCEPTION') {
            await db.query('UPDATE user_role_exceptions SET username = $1, role_id = $2, reason = $3 WHERE id = $4', [payload.username, payload.role_id, payload.reason || null, intId]);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Не удалось обновить данные', 500, error);
    }
}