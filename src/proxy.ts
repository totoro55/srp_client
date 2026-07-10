import {withAuth} from "next-auth/middleware";
import {PUBLIC_ROUTES, Role, ROLE_PERMISSIONS} from "@/lib/routes";
import {NextResponse} from "next/server";

export default withAuth(
    function middleware(req){
        const token = req.nextauth.token
        const { pathname } = req.nextUrl;

        if (PUBLIC_ROUTES.includes(pathname)) {
            console.log("proxy public route");
            return NextResponse.next();
        }

        const userRole = token?.role as Role | undefined;

        if (!userRole) {
            console.log("proxy no role");
            const loginUrl = new URL('/login', req.url);
            return NextResponse.redirect(loginUrl);
        }

        if (token && pathname === '/login'){
            console.log("proxy redirect to /login");
            return NextResponse.redirect(new URL('/', req.url));
        }

        const hasAccess = Object.entries(ROLE_PERMISSIONS).some(([role, allowedPaths]) => {
            // Check if the user possesses this specific role
            if (userRole !== role) return false;

            // Check if the current route starts with any of the allowed path patterns
            return allowedPaths.some(path => pathname === path || pathname.startsWith(`${path}/`));
        });

        if (!hasAccess) {
            console.log("proxy no access");
            const forbiddenUrl = new URL('/forbidden', req.url);
            return NextResponse.redirect(forbiddenUrl);
        }

        console.log("proxy has access");
        return NextResponse.next();
    },
    {
        callbacks:{
            authorized: ({token}) => !!token
        }
    }
    )

export const config = {
    matcher: ['/main'],
};