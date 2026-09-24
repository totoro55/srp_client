import { NextResponse } from 'next/server';
import { ApiErrorCode, ApiErrorResponse } from '@/types/api';

export function createErrorResponse(
    code: ApiErrorCode,
    message: string,
    status: number,
    details?: unknown
): NextResponse<ApiErrorResponse> {
    return NextResponse.json(
        {
            success: false,
            error: { code, message, details }
        },
        { status }
    );
}
