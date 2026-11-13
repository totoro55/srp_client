import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse } from "@/lib/require-admin";
import { ManagerGrantError } from "@/services/manager-branch-grants";
import type { ApiErrorResponse } from "@/types/api";

export function grantErrorResponse(error: unknown, fallback: string): NextResponse<ApiErrorResponse> {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
        return authResponse;
    }
    if (error instanceof ManagerGrantError) {
        const code = error.status === 403
            ? "FORBIDDEN"
            : error.status === 404
                ? "NOT_FOUND"
                : error.status === 409
                    ? "CONFLICT"
                    : "BAD_REQUEST";
        return createErrorResponse(code, error.message, error.status);
    }
    console.error(error);
    return createErrorResponse("DATABASE_ERROR", fallback, 500);
}
