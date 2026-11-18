import { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-error";
import type { RecalcScopeLevel } from "@/lib/recalc-reasons";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { beginPremiumRecalc, failPremiumRecalc, type BasketUpdateKind } from "@/services/basket-updates";
import { isStaffPeriod } from "@/services/branch-staff";
import { db } from "@/services/db";
import type { ApiResponse } from "@/types/api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS: BasketUpdateKind[] = ["sale", "release", "kassa", "osnt", "warehouse", "unloading", "selection", "shared", "tariffs", "brigade"];
const SCOPES: RecalcScopeLevel[] = ["division", "territory", "branch"];

/** Временная фикстура для проверки оверлея. Не для продакшена. */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ runId: number }>>> {
    try {
        if (process.env.NODE_ENV === "production") {
            return createErrorResponse("NOT_FOUND", "Не найдено", 404);
        }
        const access = await requirePermission("recalc:write");
        const body = await request.json() as {
            period?: unknown;
            kind?: unknown;
            scopeLevel?: unknown;
            scopeIds?: unknown;
            branchId?: unknown;
        };
        const period = typeof body.period === "string" ? body.period : "";
        const kind = typeof body.kind === "string" && KINDS.includes(body.kind as BasketUpdateKind)
            ? body.kind as BasketUpdateKind
            : null;
        const scopeLevel = typeof body.scopeLevel === "string" && SCOPES.includes(body.scopeLevel as RecalcScopeLevel)
            ? body.scopeLevel as RecalcScopeLevel
            : null;
        let scopeIds = Array.isArray(body.scopeIds)
            ? body.scopeIds.map(String).filter((id) => UUID.test(id))
            : [];
        const branchId = typeof body.branchId === "string" && UUID.test(body.branchId) ? body.branchId.toLowerCase() : null;
        if (!isStaffPeriod(period) || !kind || !scopeLevel) {
            return createErrorResponse("BAD_REQUEST", "Укажите period, kind и scopeLevel", 400);
        }
        if (scopeLevel === "territory" && scopeIds.length === 0 && branchId) {
            const rows = await db.query<{ territory: string | null }>(
                "SELECT territory_uuid::text AS territory FROM branches WHERE uuid = $1::uuid",
                [branchId],
            );
            const territory = rows[0]?.territory;
            if (!territory) {
                return createErrorResponse("BAD_REQUEST", "У филиала нет РРС", 400);
            }
            scopeIds = [territory];
        }
        if (scopeLevel !== "division" && scopeIds.length === 0) {
            return createErrorResponse("BAD_REQUEST", "Для territory/branch нужны scopeIds", 400);
        }
        const runId = await beginPremiumRecalc({
            kind,
            period,
            origin: "manual",
            trigger: "manual",
            actor: access.username,
            scopeLevel,
            scopeIds: scopeLevel === "division" ? [] : scopeIds,
            conditions: "fixture-overlay-test",
        });
        let siblingBranchId: string | null = null;
        if (scopeLevel === "territory" && scopeIds[0] && branchId) {
            const siblings = await db.query<{ id: string }>(
                `
                SELECT uuid::text AS id
                FROM branches
                WHERE territory_uuid = $1::uuid
                  AND uuid <> $2::uuid
                ORDER BY name
                LIMIT 1
                `,
                [scopeIds[0], branchId],
            );
            siblingBranchId = siblings[0]?.id ?? null;
        }
        return NextResponse.json({ success: true, data: { runId, scopeIds, siblingBranchId } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось создать фикстуру пересчёта", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось создать фикстуру пересчёта", 500);
    }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<{ closed: boolean }>>> {
    try {
        if (process.env.NODE_ENV === "production") {
            return createErrorResponse("NOT_FOUND", "Не найдено", 404);
        }
        await requirePermission("recalc:write");
        const body = await request.json() as { runId?: unknown };
        const runId = typeof body.runId === "number" ? body.runId : Number(body.runId);
        if (!Number.isFinite(runId)) {
            return createErrorResponse("BAD_REQUEST", "Укажите runId", 400);
        }
        await failPremiumRecalc(runId, "fixture-overlay-test", "fixture", { announce: false });
        return NextResponse.json({ success: true, data: { closed: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) {
            return authResponse;
        }
        console.error("Не удалось закрыть фикстуру пересчёта", error);
        return createErrorResponse("DATABASE_ERROR", "Не удалось закрыть фикстуру пересчёта", 500);
    }
}
