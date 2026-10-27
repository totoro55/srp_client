import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess } from "@/lib/require-admin";
import { listWiki } from "@/services/wiki";

export async function GET(request: Request) {
    try {
        const access = await getActiveAccess();
        const query = new URL(request.url).searchParams.get("q") ?? "";
        const tag = new URL(request.url).searchParams.get("tag") ?? "";
        return contentOk(await listWiki(access, query, tag));
    } catch (error) {
        return contentError(error, "Не удалось загрузить базу знаний");
    }
}
