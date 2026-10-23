import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission, getActiveAccess } from "@/lib/require-admin";
import { listNews, saveNews } from "@/services/news";

export async function GET() {
    try {
        const access = await getActiveAccess();
        return contentOk(await listNews(access));
    } catch (error) {
        return contentError(error, "Не удалось загрузить новости");
    }
}

export async function POST(request: Request) {
    try {
        const access = await requirePermission("news:write");
        return contentOk(await saveNews(access, null, await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сохранить новость");
    }
}
