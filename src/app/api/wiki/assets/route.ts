import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { storeWikiAsset } from "@/services/wiki";

export async function POST(request: Request) {
    try {
        const access = await requirePermission("wiki:write");
        const form = await request.formData();
        const file = form.get("file");
        const kind = form.get("kind");
        if (!(file instanceof File) || (kind !== "image" && kind !== "file")) {
            throw new ContentError("Выберите файл");
        }
        const id = await storeWikiAsset(access, file, kind);
        return contentOk({ id, src: `/api/wiki/assets/${id}` });
    } catch (error) {
        return contentError(error, "Не удалось загрузить файл");
    }
}
