import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { parseJournalDateRange, parseJournalQuery } from "@/lib/journal-query";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { expireStalePremiumRecalcs, parseJournalBasket, parseJournalStatus, readRewriteJournal, type BasketRecalcRun } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

export interface JournalPagePayload {
    events: BasketRecalcRun[];
    hasMore: boolean;
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<JournalPagePayload>>> {
    try {
        await requirePermission("monitoring:read");
        await expireStalePremiumRecalcs();
        const url = new URL(request.url);
        const beforeRaw = url.searchParams.get("before");
        const before = beforeRaw !== null && /^\d+$/.test(beforeRaw) ? Number(beforeRaw) : null;
        const dates = parseJournalDateRange(url.searchParams.get("from"), url.searchParams.get("to"));
        const page = await readRewriteJournal(
            before,
            parseJournalBasket(url.searchParams.get("kind")),
            parseJournalStatus(url.searchParams.get("status")),
            parseJournalQuery(url.searchParams.get("q")),
            dates.from,
            dates.to,
        );
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать журнал пересчёта", 500);
    }
}
