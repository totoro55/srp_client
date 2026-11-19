import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { cancelQueuedPremium } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

const MONTH = /^\d{4}-\d{2}-01$/;

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ cancelled: boolean }>>> {
    try {
        const access = await requirePermission("recalc:cancel");
        const body = (await request.json()) as { period?: unknown };
        const period = typeof body.period === "string" ? body.period.slice(0, 10) : "";
        if (!MONTH.test(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц", 400);
        }
        await cancelQueuedPremium(period, access.username);
        return NextResponse.json({ success: true, data: { cancelled: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось снять очередь пересчёта", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось снять очередь", 500);
    }
}
