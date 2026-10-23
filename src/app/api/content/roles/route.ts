import { contentError, contentOk } from "@/lib/content-response";
import { requireAnyPermission } from "@/lib/require-admin";
import { db } from "@/services/db";

export async function GET() {
    try {
        await requireAnyPermission(["news:write", "wiki:write"]);
        const roles = await db.query<{ id: number; name: string }>("SELECT id, name FROM roles ORDER BY name");
        return contentOk(roles);
    } catch (error) {
        return contentError(error, "Не удалось загрузить роли");
    }
}
