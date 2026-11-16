import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { cancelPremiumRecalc } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ cancelled: boolean }>>> {
    try {
        const access = await requirePermission("recalc:cancel");
        const body = (await request.json()) as { id?: unknown };
        const id = typeof body.id === "number" ? body.id : Number(body.id);
        if (!Number.isInteger(id) || id < 1) {
            return createErrorResponse("VALIDATION_ERROR", "Укажите запуск пересчёта", 400);
        }
        const cancelled = await cancelPremiumRecalc(id, access.username);
        if (!cancelled) {
            return createErrorResponse("VALIDATION_ERROR", "Этот пересчёт уже завершён", 409);
        }
        return NextResponse.json({ success: true, data: { cancelled: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось отменить пересчёт", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось отменить пересчёт", 500);
    }
}
