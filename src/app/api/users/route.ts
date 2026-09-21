import {NextResponse} from "next/server";
import {IUser} from "@/types/IUser";
import {cookies} from "next/headers";
import {Role} from "@/lib/routes";

export interface IApiError {
    success: false;
    message: string;
    statusCode: 100 | 401 | 403 | 500;
    details?: string;
}

const ALLOWED_ROLES: Role[] = ['admin', 'moderator'];

//TODO Удалить после добавления ДБ
const mockUsers: IUser[] = [
    {
        id: 'usr-001',
        username: 'alex_ivanov',
        email: 'alex@company.com',
        role: 'admin',
        isActive: true,
        code: 'EMP-1024',
        filialCode: 'MSK-01',
    },
    {
        id: 'usr-002',
        username: 'maria_s',
        email: 'maria.s@company.com',
        role: 'moderator',
        isActive: true,
        code: 'EMP-2048',
        filialCode: 'SPB-02',
    },
    {
        id: 'usr-003',
        username: 'ivan_petrov',
        email: 'ivan.p@company.com',
        role: 'user',
        isActive: false,
        code: 'EMP-4096',
        filialCode: 'NSK-03',
    },
    {
        id: 'usr-004',
        username: 'elena_k',
        email: 'elena.k@company.com',
        role: 'user',
        isActive: true,
        code: 'EMP-5120',
        filialCode: 'MSK-01',
    },
]

export async function GET() {
    try {
        // В будущем здесь будет запрос к БД, например: await db.user.findMany()
        return NextResponse.json(mockUsers, { status: 200 });
    } catch (error) {
        const errorResponse: IApiError = {
            success: false,
            message: 'Не удалось получить список пользователей',
            statusCode: 500,
            // Безопасно извлекаем текст ошибки, если он есть
            details: error instanceof Error ? error.message : String(error),
        };

        return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
    }
}