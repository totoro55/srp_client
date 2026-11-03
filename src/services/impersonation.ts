import { NextResponse } from "next/server";

export const IMPERSONATION_COOKIE_ROLE = "impersonated_role";
export const IMPERSONATION_COOKIE_ROLE_ID = "impersonated_role_id";
export const IMPERSONATION_COOKIE_MAX_AGE = 60 * 30;

// Стенд открывают по http://имя-пк:3000, а образ собран с NODE_ENV=production.
// Кука с Secure на таком адресе не сохраняется, и подмена роли пропадает после перезагрузки.
export function impersonationCookieSecure(request: Request): boolean {
    const forwarded = request.headers.get("x-forwarded-proto");
    if (forwarded) {
        const proto = forwarded.split(",")[0]?.trim().toLowerCase();
        if (proto === "https") {
            return true;
        }
        if (proto === "http") {
            return false;
        }
    }

    try {
        return new URL(request.url).protocol === "https:";
    } catch {
        return false;
    }
}

export function impersonationCookieOptions(maxAge: number, secure: boolean) {
    return {
        path: "/",
        httpOnly: true,
        sameSite: "lax" as const,
        secure,
        maxAge,
    };
}

export function setImpersonationCookies(response: NextResponse, roleId: number, secure: boolean): void {
    const options = impersonationCookieOptions(IMPERSONATION_COOKIE_MAX_AGE, secure);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE_ID, String(roleId), options);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE, "", { ...options, maxAge: 0 });
}

export function clearImpersonationCookies(response: NextResponse, secure: boolean): void {
    const options = impersonationCookieOptions(0, secure);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE, "", options);
    response.cookies.set(IMPERSONATION_COOKIE_ROLE_ID, "", options);
}
