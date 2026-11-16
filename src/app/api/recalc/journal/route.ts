import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, getActiveAccess } from "@/lib/require-admin";
import { expireStalePremiumRecalcs, readActorRecalcJournal, type BasketRecalcRun } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<BasketRecalcRun[]>>> {
    try {
        const access = await getActiveAccess();
        await expireStalePremiumRecalcs();
        const events = await readActorRecalcJournal(access.username);
        return NextResponse.json({ success: true, data: events });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось прочитать журнал пересчёта", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать журнал пересчёта", 500);
    }
}
