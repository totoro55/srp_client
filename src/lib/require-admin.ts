import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/auth";
import { createErrorResponse } from "@/lib/api-error";
import { isAdminRole } from "@/lib/roles";
import { ApiErrorResponse } from "@/types/api";

export { isAdminRole };

export class AdminAuthError extends Error {
    readonly status: 401 | 403;

    constructor(status: 401 | 403) {
        super(status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
        this.name = "AdminAuthError";
        this.status = status;
    }
}

export async function requireAdmin(): Promise<{ username: string }> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        throw new AdminAuthError(401);
    }

    if (!isAdminRole(session.user.role)) {
        throw new AdminAuthError(403);
    }

    return { username: session.user.username || "SYSTEM" };
}

export function adminAuthErrorResponse(
    error: unknown
): NextResponse<ApiErrorResponse> | null {
    if (!(error instanceof AdminAuthError)) {
        return null;
    }

    if (error.status === 401) {
        return createErrorResponse("UNAUTHORIZED", "Требуется авторизация", 401);
    }

    return createErrorResponse("FORBIDDEN", "Доступ ограничен", 403);
}
