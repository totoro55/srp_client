import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { airflowActor } from "@/lib/airflow-token";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { beginPremiumRecalc, failPremiumRecalc, finishPremiumRecalc, PremiumRecalcBusyError, systemTrigger } from "@/services/basket-updates";
import { calculateReleasePremium } from "@/services/release-premium";
import { SalePremiumError } from "@/services/sale-premium";
import type { ApiResponse } from "@/types/api";

interface ReleasePremiumRecalculatePayload {
    period: string;
    lines: number;
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<ReleasePremiumRecalculatePayload>>> {
    try {
        const authorization = request.headers.get("authorization");
        const loader = airflowActor(authorization);
        let actor = loader;
        if (authorization !== null && loader === null) {
            return createErrorResponse("UNAUTHORIZED", "Требуется авторизация", 401);
        }
        if (actor === null) {
            const access = await requirePermission("recalc:write");
            actor = access.username;
        }
        const body = await request.json().catch(() => null) as { period?: unknown; trigger?: unknown; announce?: unknown } | null;
        const period = typeof body?.period === "string" ? body.period : "";
        if (!/^\d{4}-\d{2}-01$/.test(period)) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц", 400);
        }
        const origin = loader ? "system" as const : "manual" as const;
        const trigger = origin === "system" ? systemTrigger(body?.trigger) : "manual";
        const runId = await beginPremiumRecalc({ kind: "release", period, origin, trigger, actor, scopeLevel: "division" });
        try {
            const lines = await calculateReleasePremium(period);
            await finishPremiumRecalc(runId, lines, { announce: body?.announce !== false });
            await audit(actor, "release-premium.recalculate", `${period}; ${origin}; ${trigger}`);
            return NextResponse.json({ success: true, data: { period, lines } });
        } catch (error) {
            await failPremiumRecalc(runId, error, "/api/branch/release-premium/recalculate");
            throw error;
        }
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof PremiumRecalcBusyError) {
            return createErrorResponse("CONFLICT", error.message, error.status);
        }
        if (error instanceof SalePremiumError) {
            return createErrorResponse("BAD_REQUEST", error.message, error.status);
        }
        console.error("Не удалось пересчитать премию за выдачу", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось пересчитать премию за выдачу", 500);
    }
}
