import { contentError, contentOk } from "@/lib/content-response";
import { ContentError } from "@/services/content-error";
import { requirePermission, getActiveAccess } from "@/lib/require-admin";
import { listNews, markAllNewsRead, saveNews } from "@/services/news";

export async function GET() {
    try {
        const access = await getActiveAccess();
        return contentOk(await listNews(access));
    } catch (error) {
        return contentError(error, "Не удалось загрузить новости");
    }
}

export async function PATCH(request: Request) {
    try {
        const access = await getActiveAccess();
        const text = await request.text();
        const body = text.trim() ? JSON.parse(text) as { all?: unknown; read?: unknown } : {};
        if (body.all !== true && body.read !== true) {
            throw new ContentError("Не удалось отметить новости прочитанными");
        }
        await markAllNewsRead(access);
        return contentOk({ read: true });
    } catch (error) {
        return contentError(error, "Не удалось отметить новости прочитанными");
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
