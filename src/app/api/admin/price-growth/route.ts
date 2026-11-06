import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { priceGrowthPeriod, priceGrowthValue, type PriceGrowthAllowance } from "@/lib/price-growth";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { deletePriceGrowthAllowance, readPriceGrowthAllowances, savePriceGrowthAllowance } from "@/services/price-growth";
import { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<PriceGrowthAllowance[]>>> {
    try {
        await requirePermission("price-growth:read");
        const rows = await readPriceGrowthAllowances();
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить надбавку", 500);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<PriceGrowthAllowance[]>>> {
    try {
        const access = await requirePermission("price-growth:write");
        const body = await request.json() as { period?: unknown; value?: unknown };
        const period = typeof body.period === "string" ? priceGrowthPeriod(body.period) : null;
        const value = priceGrowthValue(body.value);
        if (!period || value === null) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц и неотрицательное значение с точностью до копеек.", 400);
        }
        const rows = await savePriceGrowthAllowance(period, value, access.username);
        await audit(access.username, "price-growth.save", `${period} ${value}`);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось записать надбавку", 500);
    }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<PriceGrowthAllowance[]>>> {
    try {
        const access = await requirePermission("price-growth:write");
        const period = priceGrowthPeriod(new URL(request.url).searchParams.get("period") ?? "");
        if (!period) {
            return createErrorResponse("BAD_REQUEST", "Укажите месяц надбавки.", 400);
        }
        const rows = await deletePriceGrowthAllowance(period);
        await audit(access.username, "price-growth.delete", period);
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось удалить надбавку", 500);
    }
}
