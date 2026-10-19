import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { parseTariffAlgorithmInputs, type TariffAlgorithmPage } from "@/lib/tariff-algorithms";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { getTariffAlgorithmSettings, saveTariffAlgorithmSettings, TariffAlgorithmError } from "@/services/tariff-algorithms";
import { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<TariffAlgorithmPage>>> {
    try {
        await requirePermission("tariffs:read");
        const page = await getTariffAlgorithmSettings();
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить алгоритмы", 500);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<TariffAlgorithmPage>>> {
    try {
        const access = await requirePermission("tariffs:write");
        const items = parseTariffAlgorithmInputs(await request.json());
        if ("error" in items) {
            return createErrorResponse("BAD_REQUEST", items.error, 400);
        }
        const page = await saveTariffAlgorithmSettings(access, items);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        if (error instanceof TariffAlgorithmError) {
            return createErrorResponse("BAD_REQUEST", error.message, 400);
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить алгоритмы", 500);
    }
}
