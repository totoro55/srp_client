import { getToken, type JWT } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { maintenanceText } from "@/lib/app-settings";
import { getAppSettings } from "@/services/app-settings";
import { resolveAccess } from "@/server/authz/resolve-access";

async function maintenanceGate(req: NextRequest, token: JWT, pathname: string): Promise<NextResponse | null> {
    const settings = await getAppSettings();
    if (!settings.maintenanceEnabled) {
        if (pathname === "/maintenance") {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return null;
    }

    const username = typeof token.username === "string" ? token.username : "";
    const title = typeof token.title === "string" ? token.title : "";
    const access = username ? await resolveAccess(username, title, null) : null;
    if (access?.actorFullAccess) {
        if (pathname === "/maintenance") {
            return NextResponse.redirect(new URL("/", req.url));
        }
        return null;
    }

    if (pathname === "/maintenance") {
        return null;
    }

    if (pathname.startsWith("/api/")) {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: "SERVICE_UNAVAILABLE",
                    message: maintenanceText(settings.maintenanceMessage),
                },
            },
            { status: 503 }
        );
    }

    return NextResponse.redirect(new URL("/maintenance", req.url));
}

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

        const maintenanceResponse = await maintenanceGate(req, token, pathname);
        if (maintenanceResponse) {
            return maintenanceResponse;
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
