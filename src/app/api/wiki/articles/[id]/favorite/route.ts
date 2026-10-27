import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { setWikiFavorite } from "@/services/wiki";

interface Context {
    params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const id = Number((await context.params).id);
        if (!Number.isInteger(id)) {
            throw new ContentError("Статья не найдена");
        }
        const body = await request.json() as { favorite?: unknown };
        if (typeof body?.favorite !== "boolean") {
            throw new ContentError("Укажите, добавить статью в избранное или убрать");
        }
        return contentOk(await setWikiFavorite(access, id, body.favorite));
    } catch (error) {
        return contentError(error, "Не удалось изменить избранное");
    }
}
