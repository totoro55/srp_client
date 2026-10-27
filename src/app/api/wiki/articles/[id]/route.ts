import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess, requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { deleteWikiArticle, getWikiArticle, saveWikiArticle, setWikiArchived } from "@/services/wiki";

interface Context {
    params: Promise<{ id: string }>;
}

async function articleId(context: Context): Promise<number> {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id)) {
        throw new ContentError("Статья не найдена");
    }
    return id;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        return contentOk(await getWikiArticle(access, await articleId(context)));
    } catch (error) {
        return contentError(error, "Не удалось загрузить статью");
    }
}

export async function PUT(request: Request, context: Context) {
    try {
        const access = await requirePermission("wiki:write");
        return contentOk(await saveWikiArticle(access, await articleId(context), await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сохранить статью");
    }
}

export async function PATCH(request: Request, context: Context) {
    try {
        const access = await requirePermission("wiki:write");
        const body = await request.json() as { archived?: unknown };
        if (typeof body?.archived !== "boolean") {
            throw new ContentError("Укажите, в архиве статья или нет");
        }
        return contentOk(await setWikiArchived(access, await articleId(context), body.archived));
    } catch (error) {
        return contentError(error, "Не удалось изменить архив статьи");
    }
}

export async function DELETE(_request: Request, context: Context) {
    try {
        await requirePermission("wiki:write");
        const id = await articleId(context);
        await deleteWikiArticle(id);
        return contentOk({ id });
    } catch (error) {
        return contentError(error, "Не удалось удалить статью");
    }
}
