import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { saveWikiArticle } from "@/services/wiki";

export async function POST(request: Request) {
    try {
        const access = await requirePermission("wiki:write");
        return contentOk(await saveWikiArticle(access, null, await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сохранить статью");
    }
}
