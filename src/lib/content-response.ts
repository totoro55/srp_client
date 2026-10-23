import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { ApiResponse } from "@/types/api";

export function contentOk<T>(data: T): NextResponse<ApiResponse<T>> {
    return NextResponse.json({ success: true, data });
}

export function contentError(error: unknown, fallback: string): NextResponse {
    const auth = adminAuthErrorResponse(error);
    if (auth) {
        return auth;
    }
    if (error instanceof ContentError) {
        const missing = /не найден[ао]?$/.test(error.message);
        return createErrorResponse(missing ? "NOT_FOUND" : "BAD_REQUEST", error.message, missing ? 404 : 400);
    }
    return createErrorResponse("DATABASE_ERROR", fallback, 500);
}
