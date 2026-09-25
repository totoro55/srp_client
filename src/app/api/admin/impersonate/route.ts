import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";

export async function POST(request: Request) {
    try {
        // 1. Проверяем РЕАЛЬНЫЕ права пользователя через серверную сессию
        const session = await getServerSession(authOptions);

        // Внимание: проверять нужно именно изначальную роль. ИБ-защита: только ADMIN может вызывать этот эндпоинт
        if (session?.user?.role !== 'ADMIN') {
            return NextResponse.json({ success: false, error: 'Доступ запрещен' }, { status: 403 });
        }

        const { roleId, roleName } = await request.json();
        const response = NextResponse.json({ success: true });

        if (!roleName || roleName === 'RESET') {
            response.cookies.set("impersonated_role", "", { path: "/", maxAge: 0 });
            response.cookies.set("impersonated_role_id", "", { path: "/", maxAge: 0 });
        } else {
            // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Убрали httpOnly: true, чтобы JavaScript в сайдбаре мог прочитать маску
            response.cookies.set("impersonated_role", roleName, { path: "/", maxAge: 60 * 60 * 2 });
            response.cookies.set("impersonated_role_id", roleId.toString(), { path: "/", maxAge: 60 * 60 * 2 });
        }

        return response;
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Ошибка сервера' }, { status: 500 });
    }
}
