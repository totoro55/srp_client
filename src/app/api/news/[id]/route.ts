import { contentError, contentOk } from "@/lib/content-response";
import { can } from "@/lib/access";
import { AdminAuthError, getActiveAccess, requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { deleteNews, getNews, markNewsRead, markNewsUnread, rescheduleNews, saveNews } from "@/services/news";

interface Context {
    params: Promise<{ id: string }>;
}

function readId(value: string): number | null {
    return /^\d+$/.test(value) ? Number(value) : null;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const id = readId((await context.params).id);
        if (id === null) {
            return contentError(new ContentError("Новость не найдена"), "Новость не найдена");
        }
        const post = await getNews(access, id);
        if (!post) {
            return contentError(new ContentError("Новость не найдена"), "Новость не найдена");
        }
        return contentOk(post);
    } catch (error) {
        return contentError(error, "Не удалось загрузить новость");
    }
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

export async function PATCH(request: Request, context: Context) {
    let reschedule = false;
    try {
        const access = await getActiveAccess();
        const id = readId((await context.params).id);
        if (id === null) {
            return contentError(new ContentError("Новость не найдена"), "Новость не найдена");
        }
        const post = await getNews(access, id);
        if (!post) {
            return contentError(new ContentError("Новость не найдена"), "Новость не найдена");
        }
        const text = await request.text();
        const publishedAt = readPublishedAt(text);
        if (publishedAt !== null) {
            reschedule = true;
            if (!can(access, "news:write")) {
                throw new AdminAuthError(403);
            }
            return contentOk(await rescheduleNews(access, id, publishedAt));
        }
        const read = readFlag(text);
        if (read) {
            await markNewsRead(access, id);
        } else {
            await markNewsUnread(access, id);
        }
        return contentOk({ id });
    } catch (error) {
        return contentError(error, reschedule ? "Не удалось изменить время публикации" : "Не удалось изменить отметку прочтения");
    }
}

function readPublishedAt(text: string): string | null {
    if (!text.trim()) {
        return null;
    }
    try {
        const body = JSON.parse(text) as { publishedAt?: unknown };
        return typeof body.publishedAt === "string" ? body.publishedAt : null;
    } catch {
        return null;
    }
}

function readFlag(text: string): boolean {
    if (!text.trim()) {
        return true;
    }
    try {
        const body = JSON.parse(text) as { read?: unknown };
        if (typeof body.read === "boolean") {
            return body.read;
        }
    } catch {
        return true;
    }
    return true;
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
