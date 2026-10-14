import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-admin";
import { parseConnectionPeriod, parseTerritoryUuid, type RrsCoefficientPage, type RrsCoefficientValue } from "@/lib/rrs";
import { getBranchCoefficients, saveBranchCoefficients } from "@/services/basket-coefficients";
import { ApiResponse } from "@/types/api";
import { rrsErrorResponse } from "../../../http";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<RrsCoefficientPage>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        if (!territoryUuid) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Некорректная территория" },
            }, { status: 400 });
        }
        const periodParam = request.nextUrl.searchParams.get("period");
        const period = periodParam === null ? null : parseConnectionPeriod(periodParam);
        if (periodParam !== null && !period) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Некорректный период" },
            }, { status: 400 });
        }
        const page = await getBranchCoefficients(access, territoryUuid, period);
        return NextResponse.json({ success: true, data: page });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ territoryUuid: string }> },
): Promise<NextResponse<ApiResponse<{ saved: true }>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const { territoryUuid: rawUuid } = await context.params;
        const territoryUuid = parseTerritoryUuid(rawUuid);
        const body = await request.json() as { period?: unknown; items?: unknown };
        const period = parseConnectionPeriod(body.period);
        const items = readItems(body.items);
        if (!territoryUuid || !period || !items) {
            return NextResponse.json({
                success: false,
                error: { code: "BAD_REQUEST", message: "Проверьте период и коэффициенты филиалов" },
            }, { status: 400 });
        }
        await saveBranchCoefficients(access, territoryUuid, period, items);
        return NextResponse.json({ success: true, data: { saved: true } });
    } catch (error) {
        return rrsErrorResponse(error);
    }
}

function readItems(value: unknown): RrsCoefficientValue[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const items: RrsCoefficientValue[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return null;
        }
        const record = item as Record<string, unknown>;
        if (typeof record.branchUuid !== "string" || typeof record.key !== "string" || typeof record.value !== "string" || typeof record.basketId !== "number") {
            return null;
        }
        if (record.value.trim() === "") {
            continue;
        }
        items.push({
            branchUuid: record.branchUuid,
            basketId: record.basketId,
            key: record.key,
            value: record.value,
        });
    }
    return items;
}
