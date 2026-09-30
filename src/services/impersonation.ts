import { NextResponse } from "next/server";

export const IMPERSONATION_COOKIE_ROLE = "impersonated_role";
export const IMPERSONATION_COOKIE_ROLE_ID = "impersonated_role_id";
export const IMPERSONATION_COOKIE_MAX_AGE = 60 * 30;

export function impersonationCookieOptions(maxAge: number) {
    return {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        maxAge,
    };
}

export function setImpersonationCookies(response: NextResponse, roleId: number): void {
    const options = impersonationCookieOptions(IMPERSONATION_COOKIE_MAX_AGE);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE_ID, String(roleId), options);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE, "", { ...options, maxAge: 0 });
}

export function clearImpersonationCookies(response: NextResponse): void {
    const options = impersonationCookieOptions(0);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE, "", options);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE_ID, "", options);
}
