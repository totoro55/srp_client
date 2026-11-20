import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import type { StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { recalculateStmBrands } from "@/services/stm-brands";
import type { ApiResponse } from "@/types/api";

export async function POST(): Promise<NextResponse<ApiResponse<{ recalc: StartedPremiumRecalc | null }>>> {
    try {
        const access = await requirePermission("stm-brands:write");
        const recalc = await recalculateStmBrands(access.username);
        if (recalc) {
            await audit(access.username, "stm-brands.recalculate", recalc.period);
        }
        return NextResponse.json({ success: true, data: { recalc } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось запустить пересчёт", 500);
    }
}
