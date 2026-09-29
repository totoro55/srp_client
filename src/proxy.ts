import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { hasPermissionCode, matchRoutePolicy } from "@/lib/access";
import type { PermissionCode } from "@/lib/permissions";

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

        const policy = matchRoutePolicy(pathname, method);

        if (policy?.access.kind === "public" || pathname === "/login") {
            if (pathname === "/login" && token) {
                return NextResponse.redirect(new URL("/", req.url));
            }
            return NextResponse.next();
        }

        if (!token) {
            return denyRequest(req, 401, "Требуется авторизация");
        }

        const originalRole = token.role as string | undefined;
        const originalRoleId = token.roleId as number | undefined;
        const originalIsSuperuser = Boolean(token.isSuperuser) || originalRole === "ADMIN" || originalRole === "admin";

        if (pathname === "/api/admin/impersonate") {
            if (!originalIsSuperuser) {
                return denyApi("Доступ ограничен", 403, "FORBIDDEN");
            }
            return NextResponse.next();
        }

        const { getActiveSessionContext } = await import("@/services/impersonation");
        const active = await getActiveSessionContext(
            originalRole,
            originalRoleId,
            originalIsSuperuser,
            req.cookies
        );

        if (!active.activeRole) {
            return denyRequest(req, 403, "Доступ ограничен");
        }

        if (!policy) {
            return denyRequest(req, 403, "Доступ ограничен политиками ИБ компании");
        }

        if (policy.access.kind === "authenticated") {
            return NextResponse.next();
        }

        if (policy.access.kind === "superuser") {
            if (!originalIsSuperuser) {
                return denyRequest(req, 403, "Доступ ограничен политиками ИБ компании");
            }
            return NextResponse.next();
        }

        if (active.isSuperuser) {
            return NextResponse.next();
        }

        if (
            policy.access.kind === "permission" &&
            hasPermissionCode(active.codes, policy.access.permission as PermissionCode)
        ) {
            return NextResponse.next();
        }

        return denyRequest(req, 403, "Доступ ограничен политиками ИБ компании");
    } catch (error) {
        console.error("Критическая ошибка рантайма в proxy.ts:", error);
        return denyRequest(req, 500, "Внутренняя ошибка проверки доступа");
    }
}

export default proxy;

export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
