import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess } from "@/lib/require-admin";
import { searchWiki } from "@/services/wiki";

export async function GET(request: Request) {
    try {
        const access = await getActiveAccess();
        return contentOk(await searchWiki(access, new URL(request.url).searchParams));
    } catch (error) {
        return contentError(error, "Не удалось выполнить поиск");
    }
}
