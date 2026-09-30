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
        const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
        const rows = await db.query<EmployeeLookup>(
            `
            SELECT login, name, title, branch
            FROM employees
            WHERE $1::text = ''
               OR lower(login) LIKE $2 ESCAPE '\\'
               OR lower(name) LIKE $2 ESCAPE '\\'
               OR lower(title) LIKE $2 ESCAPE '\\'
               OR lower(branch) LIKE $2 ESCAPE '\\'
            ORDER BY name
            LIMIT 30
            `,
            [query, likePattern(query.toLowerCase())]
        );
        return NextResponse.json({ success: true, data: rows });
    } catch (error) {
        const authResponse = adminAuthErrorResponse(error);
        if (authResponse) return authResponse;
        return createErrorResponse("DATABASE_ERROR", "Не удалось найти сотрудников", 500);
    }
}
