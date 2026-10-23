import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess, requirePermission } from "@/lib/require-admin";
import { listRoadmap, saveRoadmap } from "@/services/roadmap";

export async function GET() {
    try {
        await getActiveAccess();
        return contentOk(await listRoadmap());
    } catch (error) {
        return contentError(error, "Не удалось загрузить дорожную карту");
    }
}

export async function POST(request: Request) {
    try {
        const access = await requirePermission("roadmap:write");
        return contentOk(await saveRoadmap(access, null, await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сохранить веху");
    }
}
