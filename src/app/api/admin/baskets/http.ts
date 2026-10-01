import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse } from "@/lib/require-admin";
import { BasketRuleError } from "@/services/baskets";
import { ApiErrorResponse } from "@/types/api";

export function basketErrorResponse(error: unknown): NextResponse<ApiErrorResponse> {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) {
        return authResponse;
    }
    if (error instanceof BasketRuleError) {
        return createErrorResponse(error.status === 404 ? "NOT_FOUND" : "BAD_REQUEST", error.message, error.status);
    }
    return createErrorResponse("DATABASE_ERROR", "Не удалось выполнить операцию с корзиной", 500);
}

export function readBasketId(value: string): number | null {
    const id = Number.parseInt(value, 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}
