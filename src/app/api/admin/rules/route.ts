import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { audit } from "@/server/authz/resolve-access";
import { ApiResponse } from "@/types/api";

function parsePositiveInt(value: unknown): number | null {
    const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

interface RuleInput {
    matchType: "login" | "title";
    matchValue: string;
    roleId: number;
    priority: number;
    expiresAt: string | null;
}

function parseRuleInput(body: {
    matchType?: unknown;
    matchValue?: unknown;
    roleId?: unknown;
    priority?: unknown;
    expiresAt?: unknown;
}): RuleInput | null {
    const matchType = body.matchType === "login" || body.matchType === "title" ? body.matchType : null;
    const matchValue = typeof body.matchValue === "string" ? body.matchValue.trim() : "";
    const roleId = parsePositiveInt(body.roleId);
    const priority = typeof body.priority === "number" ? body.priority : Number(body.priority);
    const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;
    if (!matchType || !matchValue || !roleId || !Number.isInteger(priority)) {
        return null;
    }
    return {
        matchType,
        matchValue: matchType === "login" ? matchValue.toLowerCase() : matchValue,
        roleId,
        priority,
        expiresAt: matchType === "login" ? expiresAt : null,
    };
}

export async function GET() {
    try {
        await requirePermission("access.read");
        const rules = await db.query(`
            SELECT rr.id, rr.priority, rr.match_type AS "matchType", rr.match_value AS "matchValue",
                   rr.role_id AS "roleId", r.name AS "roleName", rr.expires_at AS "expiresAt"
            FROM role_rules rr
            JOIN roles r ON r.id = rr.role_id
            ORDER BY rr.priority DESC, rr.match_type, rr.match_value
        `);
        const conflicts = await db.query<{ priority: number }>(`
            SELECT priority
            FROM role_rules
            GROUP BY priority
            HAVING COUNT(DISTINCT match_type) > 1
        `);
        return NextResponse.json({ success: true, data: { rules, conflicts: conflicts.map((row) => row.priority) } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить правила", 500);
    }
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ created: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const rule = parseRuleInput(await request.json());
        if (!rule) {
            return createErrorResponse("BAD_REQUEST", "Заполните тип, значение, роль и приоритет", 400);
        }

        const conflict = await db.query<{ id: number }>(
            "SELECT id FROM role_rules WHERE priority = $1 AND match_type <> $2 LIMIT 1",
            [rule.priority, rule.matchType]
        );
        if (conflict.length > 0) {
            return createErrorResponse(
                "BAD_REQUEST",
                "Приоритет совпадает с правилом другого типа. Один человек может попасть под оба.",
                400
            );
        }

        try {
            await db.query(
                `INSERT INTO role_rules (priority, match_type, match_value, role_id, expires_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [rule.priority, rule.matchType, rule.matchValue, rule.roleId, rule.expiresAt]
            );
        } catch {
            return createErrorResponse("BAD_REQUEST", "Такое правило уже есть", 400);
        }

        await audit(access.username, "rule.create", `${rule.matchType} ${rule.matchValue} → ${rule.roleId}`);
        return NextResponse.json({ success: true, data: { created: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить правило", 500);
    }
}

export async function PATCH(request: Request): Promise<NextResponse<ApiResponse<{ updated: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const body = (await request.json()) as {
            id?: unknown;
            matchType?: unknown;
            matchValue?: unknown;
            roleId?: unknown;
            priority?: unknown;
            expiresAt?: unknown;
        };
        const id = parsePositiveInt(body.id);
        const rule = parseRuleInput(body);
        if (!id || !rule) {
            return createErrorResponse("BAD_REQUEST", "Заполните тип, значение, роль и приоритет", 400);
        }

        const existing = await db.query<{ id: number }>("SELECT id FROM role_rules WHERE id = $1", [id]);
        if (existing.length === 0) {
            return createErrorResponse("BAD_REQUEST", "Правило не найдено", 400);
        }

        const conflict = await db.query<{ id: number }>(
            "SELECT id FROM role_rules WHERE priority = $1 AND match_type <> $2 AND id <> $3 LIMIT 1",
            [rule.priority, rule.matchType, id]
        );
        if (conflict.length > 0) {
            return createErrorResponse(
                "BAD_REQUEST",
                "Приоритет совпадает с правилом другого типа. Один человек может попасть под оба.",
                400
            );
        }

        try {
            await db.query(
                `UPDATE role_rules
                 SET priority = $2, match_type = $3, match_value = $4, role_id = $5, expires_at = $6
                 WHERE id = $1`,
                [id, rule.priority, rule.matchType, rule.matchValue, rule.roleId, rule.expiresAt]
            );
        } catch {
            return createErrorResponse("BAD_REQUEST", "Такое правило уже есть", 400);
        }

        await audit(access.username, "rule.update", `${id}: ${rule.matchType} ${rule.matchValue} → ${rule.roleId}`);
        return NextResponse.json({ success: true, data: { updated: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось сохранить правило", 500);
    }
}

export async function DELETE(request: Request): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
    try {
        const access = await requirePermission("access.write");
        const id = Number(new URL(request.url).searchParams.get("id"));
        if (!Number.isInteger(id) || id <= 0) {
            return createErrorResponse("BAD_REQUEST", "Некорректный идентификатор правила", 400);
        }

        await db.query("DELETE FROM role_rules WHERE id = $1", [id]);
        await audit(access.username, "rule.delete", String(id));
        return NextResponse.json({ success: true, data: { deleted: true } });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось удалить правило", 500);
    }
}
