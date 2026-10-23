import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { deleteWikiGroup, saveWikiGroup } from "@/services/wiki";

interface Context {
    params: Promise<{ id: string }>;
}

async function groupId(context: Context): Promise<number> {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id)) {
        throw new ContentError("Группа не найдена");
    }
    return id;
}

export async function PUT(request: Request, context: Context) {
    try {
        await requirePermission("wiki:write");
        return contentOk(await saveWikiGroup(await request.json(), await groupId(context)));
    } catch (error) {
        return contentError(error, "Не удалось сохранить группу");
    }
}

export async function DELETE(_request: Request, context: Context) {
    try {
        await requirePermission("wiki:write");
        const id = await groupId(context);
        await deleteWikiGroup(id);
        return contentOk({ id });
    } catch (error) {
        return contentError(error, "Не удалось удалить группу");
    }
}
