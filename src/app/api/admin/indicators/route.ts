import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { parseIndicatorName, type Indicator } from "@/lib/baskets";
import { requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { basketErrorResponse } from "@/app/api/admin/baskets/http";
import { BasketRuleError } from "@/services/baskets";
import { db } from "@/services/db";
import { ApiResponse } from "@/types/api";

export async function GET(): Promise<NextResponse<ApiResponse<Indicator[]>>> {
    try {
        await requirePermission("baskets:read");
        const indicators = await db.query<Indicator>("SELECT id, name FROM indicators ORDER BY name");
        return NextResponse.json({ success: true, data: indicators });
    } catch (error) {
        return basketErrorResponse(error);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<Indicator>>> {
    try {
        const access = await requirePermission("baskets:write");
        const body = await request.json();
        const name = body && typeof body === "object" ? parseIndicatorName((body as { name?: unknown }).name) : null;
        if (!name) {
            return createErrorResponse("BAD_REQUEST", "Укажите название показателя", 400);
        }

        const indicators = await db.query<Indicator>(
            "INSERT INTO indicators (name) VALUES ($1) RETURNING id, name",
            [name]
        );
        const indicator = indicators[0];
        if (!indicator) {
            throw new BasketRuleError(400, "Не удалось добавить показатель");
        }
        await audit(access.username, "indicators.create", indicator.name);
        return NextResponse.json({ success: true, data: indicator });
    } catch (error) {
        if (isIndicatorNameTaken(error)) {
            return createErrorResponse("BAD_REQUEST", "Такой показатель уже есть", 400);
        }
        return basketErrorResponse(error);
    }
}

function isIndicatorNameTaken(error: unknown): boolean {
    if (!error || typeof error !== "object") {
        return false;
    }
    const pg = error as { code?: string; constraint?: string };
    return pg.code === "23505" && pg.constraint === "indicators_name_lower_uidx";
}
