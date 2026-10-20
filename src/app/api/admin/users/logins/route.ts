import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { ADMIN_PAGE_SIZE, likePattern, pageCount, parseListPage } from "@/lib/list-page";
import { isLoginAccessSource, isLoginFailureReason, type LoginFailureReason } from "@/lib/login-journal";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";

interface EventRow {
    id: string;
    userId: number | null;
    username: string;
    success: boolean;
    ip: string | null;
    userAgent: string | null;
    title: string | null;
    department: string | null;
    accessSource: string | null;
    roleName: string | null;
    titleChanged: boolean;
    failureReason: string | null;
    createdAt: Date | string;
}

const EVENT_COLUMNS = `
    e.id::text AS id,
    e.user_id AS "userId",
    e.username,
    e.success,
    e.ip,
    e.user_agent AS "userAgent",
    e.title,
    e.department,
    e.access_source AS "accessSource",
    e.role_name AS "roleName",
    e.title_changed AS "titleChanged",
    e.failure_reason AS "failureReason",
    e.created_at AS "createdAt"
`;

export async function GET(request: Request) {
    try {
        await requirePermission("access.read");
        const params = new URL(request.url).searchParams;
        const userId = parsePositiveInt(params.get("userId"));
        const failuresOnly = params.get("outcome") === "failure";
        if (!userId && !failuresOnly) {
            return createErrorResponse("BAD_REQUEST", "Укажите пользователя или список отказов", 400);
        }

        const query = params.get("q")?.trim() ?? "";
        const reason = parseReason(params.get("reason"));
        const where = userId
            ? "WHERE e.user_id = $1"
            : `
                WHERE e.success = false
                  AND ($1 = ''
                    OR e.username ILIKE $2 ESCAPE '\\'
                    OR COALESCE(e.ip, '') ILIKE $2 ESCAPE '\\'
                    OR COALESCE(e.user_agent, '') ILIKE $2 ESCAPE '\\')
                  AND ($3 = '' OR e.failure_reason = $3)
            `;
        const filterParams = userId ? [userId] : [query, likePattern(query), reason ?? ""];
        const totals = await db.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total FROM login_events e ${where}`,
            filterParams
        );
        const total = totals[0]?.total ?? 0;
        const page = Math.min(parseListPage(params.get("page")), pageCount(total, ADMIN_PAGE_SIZE));
        const rows = await db.query<EventRow>(
            `
            SELECT ${EVENT_COLUMNS}
            FROM login_events e
            ${where}
            ORDER BY e.created_at DESC
            LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}
            `,
            [...filterParams, ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE]
        );

        return NextResponse.json({
            success: true,
            data: {
                items: rows.map(toEvent),
                page,
                pageSize: ADMIN_PAGE_SIZE,
                total,
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить историю входов", 500);
    }
}

function toEvent(row: EventRow) {
    return {
        id: row.id,
        userId: row.userId,
        username: row.username,
        success: row.success,
        ip: row.ip,
        userAgent: row.userAgent,
        title: row.title,
        department: row.department,
        accessSource: row.accessSource && isLoginAccessSource(row.accessSource) ? row.accessSource : null,
        roleName: row.roleName,
        titleChanged: row.titleChanged,
        failureReason: row.failureReason && isLoginFailureReason(row.failureReason) ? row.failureReason : null,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    };
}

function parsePositiveInt(value: string | null): number | null {
    if (!value) {
        return null;
    }
    const numeric = Number(value);
    if (!Number.isInteger(numeric) || numeric <= 0) {
        return null;
    }
    return numeric;
}

function parseReason(value: string | null): LoginFailureReason | null {
    return value && isLoginFailureReason(value) ? value : null;
}
