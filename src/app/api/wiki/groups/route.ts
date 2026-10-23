import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { saveWikiGroup } from "@/services/wiki";

export async function POST(request: Request) {
    try {
        await requirePermission("wiki:write");
        return contentOk(await saveWikiGroup(await request.json(), null));
    } catch (error) {
        return contentError(error, "Не удалось сохранить группу");
    }
}
