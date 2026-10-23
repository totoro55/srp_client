import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess, requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { ensureVersionArticle, wikiVersionHint } from "@/services/wiki";

interface Context {
    params: Promise<{ versionId: string }>;
}

function versionId(value: string): number {
    const id = Number(value);
    if (!Number.isInteger(id)) {
        throw new ContentError("Версия корзины не найдена");
    }
    return id;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const hint = await wikiVersionHint(access, versionId((await context.params).versionId));
        if (!hint) {
            throw new ContentError("Статья не найдена");
        }
        return contentOk(hint);
    } catch (error) {
        return contentError(error, "Не удалось загрузить подсказку");
    }
}

export async function POST(_request: Request, context: Context) {
    try {
        const access = await requirePermission("wiki:write");
        const id = await ensureVersionArticle(access, versionId((await context.params).versionId));
        return contentOk({ id });
    } catch (error) {
        return contentError(error, "Не удалось открыть описание версии");
    }
}
