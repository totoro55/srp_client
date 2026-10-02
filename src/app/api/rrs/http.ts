import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse } from "@/lib/require-admin";
import { RrsRuleError } from "@/services/basket-connections";
import { ApiErrorResponse } from "@/types/api";

export function rrsErrorResponse(error: unknown): NextResponse<ApiErrorResponse> {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
        return authResponse;
    }
    if (error instanceof RrsRuleError) {
        const code = error.status === 403 ? "FORBIDDEN" : error.status === 404 ? "NOT_FOUND" : "BAD_REQUEST";
        return createErrorResponse(code, error.message, error.status);
    }
    console.error(error);
    return createErrorResponse("DATABASE_ERROR", "Не удалось выполнить операцию с настройками РРС", 500);
}
