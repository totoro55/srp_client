// src/app/api/admin/permissions/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/services/db';
import { ApiResponse, Permission } from '@/types/api';
import {createErrorResponse} from "@/lib/api-error";

export async function GET(): Promise<NextResponse<ApiResponse<Permission[]>>> {
    try {
        const permissions = await db.query<Permission>(
            'SELECT * FROM permissions ORDER BY id DESC'
        );
        return NextResponse.json({ success: true, data: permissions });
    } catch (error) {
        return createErrorResponse(
            'DATABASE_ERROR',
            'Не удалось загрузить разрешения из базы данных',
            500,
            error instanceof Error ? error.message : error
        );
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ id: number }>>> {
    try {
        const body = await request.json();
        const { route_path, method, description } = body as Partial<Omit<Permission, 'id' | 'created_at'>>;

        if (!route_path || !method) {
            return createErrorResponse(
                'BAD_REQUEST',
                'Поля route_path и method обязательны для заполнения',
                400
            );
        }

        const result = await db.query<{ id: number }>(
            `INSERT INTO permissions (route_path, method, description) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (route_path, method) DO NOTHING 
       RETURNING id`,
            [route_path, method, description || null]
        );

        if (result.length === 0) {
            return createErrorResponse(
                'BAD_REQUEST',
                'Такое разрешение (путь + метод) уже существует в системе',
                400
            );
        }

        return NextResponse.json({ success: true, data: { id: result[0].id } });
    } catch (error) {
        return createErrorResponse(
            'INTERNAL_SERVER_ERROR',
            'Внутренняя ошибка сервера при создании разрешения',
            500,
            error instanceof Error ? error.message : error
        );
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return createErrorResponse('BAD_REQUEST', 'ID обязателен', 400);

        await db.query('DELETE FROM permissions WHERE id = \$1', [parseInt(id, 10)]);
        return NextResponse.json({ success: true });
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Не удалось удалить роут', 500, error);
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { id, route_path, method, description } = body;

        if (!id || !route_path || !method) {
            return createErrorResponse('BAD_REQUEST', 'Недостаточно данных для обновления', 400);
        }

        await db.query(
            `UPDATE permissions 
       SET route_path = $1, method = $2, description = $3 
       WHERE id = $4`,
            [route_path, method, description || null, parseInt(id, 10)]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        return createErrorResponse('DATABASE_ERROR', 'Не удалось обновить роут', 500, error);
    }
}
