import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess } from "@/lib/require-admin";
import { db } from "@/services/db";

export interface NewsMention {
    login: string;
    name: string;
    title: string;
}

function likePattern(value: string): string {
    const escaped = value.replace(/[\\%_]/g, (char) => `\\${char}`);
    return `%${escaped}%`;
}

export async function GET(request: Request) {
    try {
        await getActiveAccess();
        const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
        const rows = await db.query<NewsMention>(
            `
            SELECT employee.login,
                   employee.name,
                   employee.title
            FROM employees employee
            WHERE $1::text = ''
               OR lower(employee.login) LIKE $2 ESCAPE '\\'
               OR lower(employee.name) LIKE $2 ESCAPE '\\'
               OR lower(employee.title) LIKE $2 ESCAPE '\\'
            ORDER BY employee.name
            LIMIT 8
            `,
            [query, likePattern(query.toLowerCase())],
        );
        return contentOk(rows);
    } catch (error) {
        return contentError(error, "Не удалось найти сотрудников");
    }
}
