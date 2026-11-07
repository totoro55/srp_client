import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { airflowActor } from "@/lib/airflow-token";
import { adminAuthErrorResponse, requireAnyPermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
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
            const access = await requireAnyPermission(["branch:read", "baskets:connect"]);
            actor = access.username;
        }
        const body = await request.json().catch(() => null) as { period?: unknown } | null;
        const period = typeof body?.period === "string" ? body.period : "";
        const lines = await calculateReleasePremium(period);
        await audit(actor, "release-premium.recalculate", period);
        return NextResponse.json({ success: true, data: { period, lines } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof SalePremiumError) {
            return createErrorResponse("BAD_REQUEST", error.message, error.status);
        }
        console.error("Не удалось пересчитать премию за выдачу", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось пересчитать премию за выдачу", 500);
    }
}
