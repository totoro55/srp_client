import { NextResponse } from "next/server";
import { adminAuthErrorResponse, requireAdmin } from "@/lib/require-admin";
import { createErrorResponse } from "@/lib/api-error";
import { discoverAppRoutes } from "@/lib/discover-app-routes";
import { ApiResponse, DiscoveredAppRoutes } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<DiscoveredAppRoutes>>> {
    try {
        await requireAdmin();
        const data = await discoverAppRoutes();
        return NextResponse.json({ success: true, data });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("INTERNAL_SERVER_ERROR", "Ошибка сканирования маршрутов", 500);
    }
}
