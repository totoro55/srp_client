import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { ADMIN_PAGE_SIZE, likePattern, pageCount, parseListPage } from "@/lib/list-page";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";

interface UserRow {
    id: number;
    username: string;
    displayName: string;
    email: string | null;
    department: string | null;
    title: string;
    firstLoginAt: Date | string | null;
    lastLoginAt: Date | string | null;
    lastIp: string | null;
}

const USER_FILTER = `
    WHERE ($1 = ''
        OR u.display_name ILIKE $2 ESCAPE '\\'
        OR u.username ILIKE $2 ESCAPE '\\'
        OR COALESCE(u.email, '') ILIKE $2 ESCAPE '\\'
        OR u.title ILIKE $2 ESCAPE '\\'
        OR COALESCE(u.department, '') ILIKE $2 ESCAPE '\\')
      AND ($3 = '' OR u.department = $3)
`;

export async function GET(request: Request) {
    try {
        await requirePermission("access.read");
        const params = new URL(request.url).searchParams;
        const query = params.get("q")?.trim() ?? "";
        const department = params.get("department")?.trim() ?? "";
        const filterParams = [query, likePattern(query), department];

        const totals = await db.query<{ total: number }>(
            `SELECT COUNT(*)::int AS total FROM users u ${USER_FILTER}`,
            filterParams
        );
        const total = totals[0]?.total ?? 0;
        const page = Math.min(parseListPage(params.get("page")), pageCount(total, ADMIN_PAGE_SIZE));
        const rows = await db.query<UserRow>(
            `
            SELECT u.id,
                   u.username,
                   u.display_name AS "displayName",
                   u.email,
                   u.department,
                   u.title,
                   u.first_login_at AS "firstLoginAt",
                   u.last_login_at AS "lastLoginAt",
                   last_event.ip AS "lastIp"
            FROM users u
            LEFT JOIN LATERAL (
                SELECT ip
                FROM login_events
                WHERE user_id = u.id AND success = true
                ORDER BY created_at DESC
                LIMIT 1
            ) last_event ON true
            ${USER_FILTER}
            ORDER BY u.last_login_at DESC NULLS LAST, u.username
            LIMIT $4 OFFSET $5
            `,
            [...filterParams, ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE]
        );
        const departments = await db.query<{ department: string }>(
            `
            SELECT DISTINCT department
            FROM users
            WHERE department IS NOT NULL AND btrim(department) <> ''
            ORDER BY department
            `
        );

        return NextResponse.json({
            success: true,
            data: {
                items: rows.map((row) => ({
                    ...row,
                    firstLoginAt: iso(row.firstLoginAt),
                    lastLoginAt: iso(row.lastLoginAt),
                })),
                page,
                pageSize: ADMIN_PAGE_SIZE,
                total,
                departments: departments.map((row) => row.department),
            },
        });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось загрузить пользователей", 500);
    }
}

function iso(value: Date | string | null): string | null {
    if (value instanceof Date) {
        return value.toISOString();
    }
    return value;
}
