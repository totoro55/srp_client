import { NextResponse } from "next/server";
import { PERMISSION_CATALOG } from "@/lib/permissions";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";

export async function GET() {
    try {
        await requirePermission("access.read");
        return NextResponse.json({ success: true, data: PERMISSION_CATALOG });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать каталог", 500);
    }
}
