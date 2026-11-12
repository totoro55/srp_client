import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { normalizeAutoSchedules, readAutoSchedules, saveAutoSchedules, type AutoSchedules } from "@/services/recalc-schedule";
import type { ApiResponse } from "@/types/api";

function describe(schedule: AutoSchedules): string {
    const tariffs = schedule.saleTariffs.day === null
        ? "тарифы не заданы"
        : `тарифы=${schedule.saleTariffs.day} ${schedule.saleTariffs.time}`;
    const baskets = schedule.baskets.time === ""
        ? "корзины не заданы"
        : `корзины=${schedule.baskets.time}`;
    return `${tariffs}; ${baskets}`;
}

export async function GET(): Promise<NextResponse<ApiResponse<AutoSchedules>>> {
    try {
        await requirePermission("baskets:read");
        const schedule = await readAutoSchedules();
        return NextResponse.json({ success: true, data: schedule });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось прочитать расписание пересчёта", 500);
    }
}

export async function PUT(request: Request): Promise<NextResponse<ApiResponse<AutoSchedules>>> {
    try {
        const access = await requirePermission("baskets:connect");
        const schedule = normalizeAutoSchedules(await request.json());
        if (!schedule) {
            return createErrorResponse(
                "BAD_REQUEST",
                "Для тарифов укажите день от 1 до 28 и время вместе. Для расчётов по корзинам — время или пустое поле. Время — часы и минуты.",
                400,
            );
        }
        const saved = await saveAutoSchedules(schedule, access.username);
        await audit(access.username, "premium-schedule.update", describe(saved));
        return NextResponse.json({ success: true, data: saved });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить расписание пересчёта", 500);
    }
}
