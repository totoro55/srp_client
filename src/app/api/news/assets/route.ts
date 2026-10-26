import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { storeNewsAsset } from "@/services/news";

export async function POST(request: Request) {
    try {
        const access = await requirePermission("news:write");
        const form = await request.formData();
        const file = form.get("file");
        const kind = form.get("kind");
        if (!(file instanceof File) || (kind !== "image" && kind !== "file")) {
            throw new ContentError("Выберите файл");
        }
        const id = await storeNewsAsset(access, file, kind);
        return contentOk({ id, src: `/api/news/assets/${id}` });
    } catch (error) {
        return contentError(error, "Не удалось загрузить файл");
    }
}
