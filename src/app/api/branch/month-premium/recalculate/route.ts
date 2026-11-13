import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { airflowActor } from "@/lib/airflow-token";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { recalculateMonthSelection, type MonthRecalcTarget } from "@/services/branch-premium-recalc";
import { PremiumRecalcBusyError, systemTrigger } from "@/services/basket-updates";
import { SalePremiumError } from "@/services/sale-premium";
import type { ApiResponse } from "@/types/api";

interface MonthPremiumRecalculatePayload {
    period: string;
}

interface MonthPremiumBody {
    period?: unknown;
    from?: unknown;
    until?: unknown;
    target?: unknown;
    dismissal?: unknown;
    transfer?: unknown;
    title?: unknown;
    trigger?: unknown;
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<MonthPremiumRecalculatePayload>>> {
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
        const body = await request.json().catch(() => null) as MonthPremiumBody | null;
        const period = typeof body?.period === "string" ? body.period : "";
        const from = typeof body?.from === "string" ? body.from : "";
        const until = typeof body?.until === "string" ? body.until : "";
        const dismissal = flag(body?.dismissal);
        const transfer = flag(body?.transfer);
        const title = flag(body?.title);
        const target = parseTarget(body?.target);
        if (!target || dismissal === null || transfer === null || title === null) {
            return createErrorResponse("BAD_REQUEST", "Укажите даты и условия", 400);
        }
        const origin = loader ? "system" as const : "manual" as const;
        const trigger = origin === "system" ? systemTrigger(body?.trigger) : "manual";
        await recalculateMonthSelection({ period, from, until, target, dismissal, transfer, title, actor, trigger, origin, route: "/api/branch/month-premium/recalculate" });
        await audit(actor, "month-premium.recalculate", `${period}; ${from}; ${until}; ${target}; ${origin}; ${trigger}`);
        return NextResponse.json({ success: true, data: { period } });
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
        console.error("Не удалось пересчитать месяц", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось пересчитать месяц", 500);
    }
}

function flag(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

const TARGETS: MonthRecalcTarget[] = ["baskets", "sale", "release", "kassa", "shared"];

function parseTarget(value: unknown): MonthRecalcTarget | null {
    return typeof value === "string" && TARGETS.includes(value as MonthRecalcTarget) ? value as MonthRecalcTarget : null;
}
