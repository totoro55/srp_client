import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PUBLIC_ROUTES, Role, ROLE_PERMISSIONS } from "@/lib/routes";

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/api/auth') ||
        pathname.includes('.') ||
        PUBLIC_ROUTES.includes(pathname)
    ) {
        return NextResponse.next();
    }

    //const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const token = { role: 'admin' }
    if (!token) {
        if (pathname === '/login') return NextResponse.next();
        return NextResponse.redirect(new URL('/login', req.url));
    }

    if (pathname === '/login') {
        return NextResponse.redirect(new URL('/', req.url));
    }

    const userRole = token?.role as Role | undefined;
    if (!userRole) {
        if (pathname === '/forbidden') return NextResponse.next();
        return NextResponse.redirect(new URL('/forbidden', req.url));
    }

    const hasAccess = Object.entries(ROLE_PERMISSIONS).some(([role, allowedPaths]) => {
        if (userRole !== role) return false;
        return allowedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
    });

    if (!hasAccess) {
        if (pathname === '/forbidden') return NextResponse.next();
        return NextResponse.redirect(new URL('/forbidden', req.url));
    }

    return NextResponse.next();
}

export default proxy;

export const config = {
    matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};