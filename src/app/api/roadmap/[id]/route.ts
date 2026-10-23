import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { deleteRoadmap, saveRoadmap } from "@/services/roadmap";

interface Context {
    params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: Context) {
    try {
        const access = await requirePermission("roadmap:write");
        const id = Number((await context.params).id);
        if (!Number.isInteger(id)) {
            throw new ContentError("Веха не найдена");
        }
        return contentOk(await saveRoadmap(access, id, await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сохранить веху");
    }
}

export async function DELETE(_request: Request, context: Context) {
    try {
        await requirePermission("roadmap:write");
        const id = Number((await context.params).id);
        if (!Number.isInteger(id)) {
            throw new ContentError("Веха не найдена");
        }
        await deleteRoadmap(id);
        return contentOk({ id });
    } catch (error) {
        return contentError(error, "Не удалось удалить веху");
    }
}
