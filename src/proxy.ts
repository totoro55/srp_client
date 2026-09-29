import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAdminRole } from "@/lib/roles";
import { UserPermission } from "@/types/next-auth";

function isRouteAllowed(
    currentPath: string,
    currentMethod: string,
    allowedPermissions: UserPermission[]
): boolean {
    if (!allowedPermissions || allowedPermissions.length === 0) return false;

    const [cleanPath] = currentPath.split("?");

    return allowedPermissions.some((perm) => {
        const methodMatches =
            perm.method === "ALL" || perm.method.toUpperCase() === currentMethod.toUpperCase();
        if (!methodMatches) return false;

        const regexPattern = perm.path
            .replace(/([.+?^${}()|[\]\\])/g, "\\$1")
            .replace(/\*/g, ".*");

        const routeRegex = new RegExp(`^${regexPattern}$`, "i");
        return routeRegex.test(cleanPath);
    });
}

function denyApi(message: string, status: number, code: string): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: { code, message },
        },
        { status, headers: { "Content-Type": "application/json" } }
    );
}

function denyRequest(req: NextRequest, status: number, message: string): NextResponse {
    if (req.nextUrl.pathname.startsWith("/api/")) {
        const code =
            status === 403 ? "FORBIDDEN" : status === 401 ? "UNAUTHORIZED" : "INTERNAL_SERVER_ERROR";
        return denyApi(message, status, code);
    }

    if (status === 401 || status >= 500) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.redirect(new URL("/forbidden", req.url));
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const method = req.method;

    try {
        if (
            pathname.startsWith("/_next") ||
            pathname.startsWith("/api/auth") ||
            pathname.includes(".") ||
            pathname === "/forbidden" ||
            pathname === "/unauthorized"
        ) {
            const response = NextResponse.next();
            response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
            return response;
        }

        const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
        });

        if (pathname === "/login") {
            if (token) {
                return NextResponse.redirect(new URL("/", req.url));
            }
            return NextResponse.next();
        }

        if (!token) {
            return denyRequest(req, 401, "Требуется авторизация");
        }

        const originalRole = token.role as string | undefined;

        // Сброс/смена маски должна работать и во время имперсонации: смотрим родную роль JWT.
        if (pathname === "/api/admin/impersonate") {
            if (!isAdminRole(originalRole)) {
                return denyApi("Доступ ограничен", 403, "FORBIDDEN");
            }
            return NextResponse.next();
        }

        const originalPermissions = (token.permissions as UserPermission[] | undefined) || [];

        const { getActiveSessionContext } = await import("@/services/impersonation");
        const { activeRole, activePermissions } = await getActiveSessionContext(
            originalRole,
            originalPermissions,
            req.cookies
        );

        if (!activeRole) {
            return denyRequest(req, 403, "Доступ ограничен");
        }

        if (isAdminRole(activeRole)) {
            return NextResponse.next();
        }

        const hasAccess = isRouteAllowed(pathname, method, activePermissions);

        if (!hasAccess) {
            return denyRequest(
                req,
                403,
                "Доступ ограничен политиками ИБ компании"
            );
        }

        return NextResponse.next();
    } catch (error) {
        console.error("Критическая ошибка рантайма в proxy.ts:", error);
        return denyRequest(req, 500, "Внутренняя ошибка проверки доступа");
    }
}

export default proxy;

export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
