import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { storeWikiAsset } from "@/services/wiki";

export async function POST(request: Request) {
    try {
        const access = await requirePermission("wiki:write");
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
            throw new ContentError("Выберите снимок");
        }
        const id = await storeWikiAsset(access, file);
        return contentOk({ id, src: `/api/wiki/assets/${id}` });
    } catch (error) {
        return contentError(error, "Не удалось загрузить снимок");
    }
}
