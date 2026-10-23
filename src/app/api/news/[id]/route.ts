import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { deleteNews, saveNews } from "@/services/news";

interface Context {
    params: Promise<{ id: string }>;
}

function readId(value: string): number | null {
    return /^\d+$/.test(value) ? Number(value) : null;
}

export async function PUT(request: Request, context: Context) {
    try {
        const access = await requirePermission("news:write");
        const id = readId((await context.params).id);
        if (id === null) {
            return contentError(new Error("bad"), "Новость не найдена");
        }
        return contentOk(await saveNews(access, id, await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сохранить новость");
    }
}

export async function DELETE(_request: Request, context: Context) {
    try {
        await requirePermission("news:write");
        const id = readId((await context.params).id);
        if (id === null) {
            return contentError(new Error("bad"), "Новость не найдена");
        }
        await deleteNews(id);
        return contentOk({ id });
    } catch (error) {
        return contentError(error, "Не удалось удалить новость");
    }
}
