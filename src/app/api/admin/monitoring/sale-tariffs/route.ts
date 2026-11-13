import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid } from "@/lib/rrs";
import { listSaleTariffTargets, SaleTariffBatchError, startSaleTariffRecalc, type SaleTariffTarget } from "@/services/tariff-auto";
import type { ApiResponse } from "@/types/api";

export async function GET(request: Request): Promise<NextResponse<ApiResponse<SaleTariffTarget[]>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const period = parseConnectionPeriod(new URL(request.url).searchParams.get("period"));
        if (!period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период" },
            }, { status: 400 });
        }
        const targets = await listSaleTariffTargets(access, period);
        return NextResponse.json({ success: true, data: targets });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать тарифы продажи", 500);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ started: number }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const body = await request.json() as { period?: unknown; territories?: unknown };
        const period = parseConnectionPeriod(body.period);
        const territories = Array.isArray(body.territories)
            ? body.territories.map(parseTerritoryUuid).filter((item): item is string => item !== null)
            : [];
        if (!period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период" },
            }, { status: 400 });
        }
        const started = await startSaleTariffRecalc(access, period, territories);
        return NextResponse.json({ success: true, data: started });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof SaleTariffBatchError) {
            return NextResponse.json({
                success: false,
                error: { code: error.status === 409 ? "CONFLICT" : "BAD_REQUEST", message: error.message },
            }, { status: error.status });
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось запустить пересчёт тарифов", 500);
    }
}
