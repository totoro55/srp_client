// proxy.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { UserPermission } from "@/types/next-auth";

/**
 * Валидация текущего URL запроса по регулярным выражениям wildcards из JWT
 */
function isRouteAllowed(
    currentPath: string,
    currentMethod: string,
    allowedPermissions: UserPermission[]
): boolean {
    if (!allowedPermissions || allowedPermissions.length === 0) return false;

    // Отсекаем query-параметры (?id=42), оставляя чистую строку пути
    const [cleanPath] = currentPath.split('?');

    return allowedPermissions.some((perm) => {
        const methodMatches = perm.method === 'ALL' || perm.method.toUpperCase() === currentMethod.toUpperCase();
        if (!methodMatches) return false;

        const regexPattern = perm.path
            .replace(/([.+?^\${}()|[\]\\])/g, '\\$1') // Экранируем спецсимволы
            .replace(/\*/g, '.*');                 // Подменяем * на фиксатор любых символов

        const routeRegex = new RegExp(`^${regexPattern}$`, 'i');
        return routeRegex.test(cleanPath);
    });
}

/**
 * Главный прокси-перехватчик трафика приложения
 */
export async function proxy(req: NextRequest) {
    try {
        const { pathname } = req.nextUrl;
        const method = req.method;

        // ШАГ 1: АБСОЛЮТНЫЙ И БЕЗУСЛОВНЫЙ ПРОПУСК ТЕХНИЧЕСКИХ ПУТЕЙ И СТАТИКИ
        if (
            pathname.startsWith('/_next') ||
            pathname.startsWith('/api/auth') ||
            pathname === '/api/admin/impersonate' ||
            pathname.includes('.') ||
            pathname === '/login' ||
            pathname === '/forbidden' ||
            pathname === '/unauthorized'
        ) {
            const response = NextResponse.next();
            response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response;
        }

        // Декодируем оригинальный шифрованный JWT-токен куки NextAuth
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET });

        // ШАГ 2: Защита от неавторизованного входа
        if (!token) {
            if (pathname === '/login') return NextResponse.next();
            return NextResponse.redirect(new URL('/login', req.url));
        }

        // ШАГ 3: Редирект авторизованного пользователя с экрана логина на главную
        if (pathname === '/login') {
            return NextResponse.redirect(new URL('/', req.url));
        }

        const originalRole = token.role as string | undefined;
        const originalPermissions = (token.permissions as UserPermission[] | undefined) || [];

        // ШАГ 4: ВЫЗОВ ДЕКОМПОЗИРОВАННОГО СЕРВИСА ИМПЕРСОНАЦИИ (ТЕСТИРОВАНИЯ РОЛЕЙ)
        const { getActiveSessionContext } = await import("@/services/impersonation");
        const { activeRole, activePermissions } = await getActiveSessionContext(
            originalRole,
            originalPermissions,
            req.cookies
        );

        if (!activeRole) {
            return NextResponse.redirect(new URL('/forbidden', req.url));
        }

        // ШАГ 5: Если результирующая роль ADMIN (или родная, или выбранная в маске) — сквозной доступ
        if (activeRole === 'ADMIN' || activeRole === 'admin') {
            return NextResponse.next();
        }

        // ШАГ 6: Сверяем текущий роут с результирующей матрицей прав (актуально для тестов)
        const hasAccess = isRouteAllowed(pathname, method, activePermissions);

        if (!hasAccess) {
            // Если заблокирован REST API запрос — отдаем чистый JSON статус 403 Forbidden
            if (pathname.startsWith('/api/')) {
                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Доступ ограничен политиками ИБ компании (Режим Тестирования)' }
                    }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            }

            // Если заблокирована страница — мягко редиректим интерфейс на 403 карточку
            return NextResponse.redirect(new URL('/forbidden', req.url));
        }

        return NextResponse.next();
    } catch (error) {
        console.error("Критическая ошибка рантайма в proxy.ts:", error);
        return NextResponse.next(); // Резервный шлюз безопасности
    }
}

export default proxy;

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
