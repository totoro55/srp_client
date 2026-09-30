import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isPublicPath(pathname: string): boolean {
    return (
        pathname === "/login" ||
        pathname === "/forbidden" ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/_next") ||
        pathname.includes(".")
    );
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    try {
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

        if (isPublicPath(pathname)) {
            return NextResponse.next();
        }

        if (!token) {
            if (pathname.startsWith("/api/")) {
                return NextResponse.json(
                    { success: false, error: { code: "UNAUTHORIZED", message: "Требуется авторизация" } },
                    { status: 401 }
                );
            }
            return NextResponse.redirect(new URL("/login", req.url));
        }

        return NextResponse.next();
    } catch (error) {
        console.error("Ошибка проверки входа:", error);
        if (pathname.startsWith("/api/")) {
            return NextResponse.json(
                { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "Внутренняя ошибка проверки доступа" } },
                { status: 500 }
            );
        }
        return NextResponse.redirect(new URL("/login", req.url));
    }
}

export default proxy;

export const config = {
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
