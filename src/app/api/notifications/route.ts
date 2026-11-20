import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess } from "@/lib/require-admin";
import { listNotifications, readNotifications, summarizeNotifications } from "@/services/notifications";

export async function GET(request: Request) {
    try {
        const access = await getActiveAccess();
        if (new URL(request.url).searchParams.get("summary") === "1") {
            return contentOk(await summarizeNotifications(access));
        }
        return contentOk(await listNotifications(access));
    } catch (error) {
        return contentError(error, "Не удалось загрузить уведомления");
    }
}

export async function POST(request: Request) {
    try {
        const access = await getActiveAccess();
        return contentOk(await readNotifications(access, await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось обновить уведомления");
    }
}
