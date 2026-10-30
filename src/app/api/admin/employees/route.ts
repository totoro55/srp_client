import { NextResponse } from "next/server";
import { db } from "@/services/db";
import { createErrorResponse } from "@/lib/api-error";
import { adminAuthErrorResponse, requirePermission } from "@/lib/require-admin";
import { ApiResponse } from "@/types/api";

export interface EmployeeLookup {
    login: string;
    name: string;
    title: string;
    branch: string;
}

function likePattern(value: string): string {
    const escaped = value.replace(/[\\%_]/g, (char) => `\\${char}`);
    return `%${escaped}%`;
}

export async function GET(request: Request): Promise<NextResponse<ApiResponse<EmployeeLookup[]>>> {
    try {
        await requirePermission("access.read");
        const params = new URL(request.url).searchParams;
        const query = params.get("q")?.trim().slice(0, 100) ?? "";
        const includeDeleted = params.get("includeDeleted") === "1";
        const rows = await db.query<EmployeeLookup>(
            `
            SELECT employee.login,
                   employee.name,
                   employee.title,
                   COALESCE(branch.name, '') AS branch
            FROM employees employee
            LEFT JOIN branches branch ON branch.uuid = employee.branch_uuid
            WHERE (
                $1::text = ''
                OR lower(employee.login) LIKE $2 ESCAPE '\\'
                OR lower(employee.name) LIKE $2 ESCAPE '\\'
                OR lower(employee.title) LIKE $2 ESCAPE '\\'
                OR lower(branch.name) LIKE $2 ESCAPE '\\'
            )
              AND (NOT employee.deleted OR $3::boolean)
            ORDER BY employee.name
            LIMIT 30
            `,
            [query, likePattern(query.toLowerCase()), includeDeleted]
        );
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось найти сотрудников", 500);
    }
}
