import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { saveWikiOrder } from "@/services/wiki";

export async function POST(request: Request) {
    try {
        await requirePermission("wiki:write");
        await saveWikiOrder(await request.json());
        return contentOk({ saved: true });
    } catch (error) {
        return contentError(error, "Не удалось сохранить порядок");
    }
}
