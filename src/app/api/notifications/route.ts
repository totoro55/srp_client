import { contentError, contentOk } from "@/lib/content-response";
import { getActiveAccess } from "@/lib/require-admin";
import { listNotifications, readNotifications } from "@/services/notifications";

export async function GET() {
    try {
        const access = await getActiveAccess();
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
