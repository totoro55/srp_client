// proxy.ts
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface UserPermission {
    path: string;
    method: string;
}

/**
 * Валидация текущего URL запроса по регулярным выражениям wildcards из JWT
 */
function isRouteAllowed(
    currentPath: string,
    currentMethod: string,
    allowedPermissions: UserPermission[]
): boolean {
    if (!allowedPermissions || allowedPermissions.length === 0) return false;

    // Отсекаем query-параметры (?id=1), оставляя строго чистую строку пути
    const [cleanPath] = currentPath.split('?');

    return allowedPermissions.some((perm) => {
        // 1. Проверяем HTTP метод (если в БД стоит ALL — разрешено любое действие)
        const methodMatches = perm.method === 'ALL' || perm.method.toUpperCase() === currentMethod.toUpperCase();
        if (!methodMatches) return false;

        // 2. Превращаем wildcard маску пути в регулярное выражение
        const regexPattern = perm.path
            .replace(/([.+?^${}()|[\]\\])/g, '\\$1') // Экранируем спецсимволы
            .replace(/\*/g, '.*');                 // Превращаем звездочку в '.*' (любые символы)

        const routeRegex = new RegExp(`^${regexPattern}$`, 'i');
        return routeRegex.test(cleanPath);
    });
}

export async function proxy(req: NextRequest) {
    try {
        const { pathname } = req.nextUrl;
        const method = req.method;

        // ШАГ 1: АБСОЛЮТНЫЙ И БЕЗУСЛОВНЫЙ ПРОПУСК СЕРВИСНЫХ ПУТЕЙ И АССЕТОВ
        // (Эти роуты никогда не блокируются и не кэшируются во избежание сбоев CSRF)
        if (
            pathname.startsWith('/_next') ||
            pathname.startsWith('/api/auth') ||
            pathname.includes('.') ||
            pathname === '/login' ||
            pathname === '/forbidden' ||
            pathname === '/unauthorized'
        ) {
            const response = NextResponse.next();
            response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
            return response;
        }

        // Извлекаем и автоматически декодируем токен сессии NextAuth
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

        const userRole = token.role as string | undefined;
        const userPermissions = (token.permissions as UserPermission[] | undefined) || [];

        if (!userRole) {
            return NextResponse.redirect(new URL('/forbidden', req.url));
        }

        // ШАГ 4: Роль ADMIN имеет безусловный сквозной доступ к любым страницам и API
        if (userRole === 'ADMIN' || userRole === 'admin') {
            return NextResponse.next();
        }

        // ШАГ 5: Сверяем текущий клик/запрос с динамической матрицей прав из JWT
        const hasAccess = isRouteAllowed(pathname, method, userPermissions);

        if (!hasAccess) {
            // Если закрыт доступ к бэкенд API — отдаем чистый JSON статус 403 Forbidden
            if (pathname.startsWith('/api/')) {
                return new NextResponse(
                    JSON.stringify({
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Доступ ограничен.' }
                    }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                );
            }

            // Если закрыт доступ к интерфейсной странице — отправляем на /forbidden
            return NextResponse.redirect(new URL('/forbidden', req.url));
        }

        return NextResponse.next();
    } catch (error) {
        console.error("Критический сбой в proxy:", error);
        // Резервный шлюз: в случае сбоя пропускаем запрос, чтобы не вызвать отказ всей системы
        return NextResponse.next();
    }
}

export default proxy;

// КОНФИГ МАТЧЕРА С ИЗОЛЯЦИЕЙ ИСХОДНЫХ ПУТЕЙ NEXT-AUTH
export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
