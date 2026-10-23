import { contentError, contentOk } from "@/lib/content-response";
import { isFeedbackStatus } from "@/lib/content";
import { getActiveAccess } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { feedbackChanges } from "@/services/feedback";

interface Context {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const id = Number((await context.params).id);
        if (!Number.isInteger(id)) {
            throw new ContentError("Обращение не найдено");
        }
        const url = new URL(request.url);
        const after = Number(url.searchParams.get("after"));
        const status = url.searchParams.get("status");
        const response = contentOk(await feedbackChanges(
            access,
            id,
            Number.isInteger(after) && after > 0 ? after : 0,
            status && isFeedbackStatus(status) ? status : null,
            url.searchParams.get("assignee"),
        ));
        response.headers.set("Cache-Control", "no-store");
        return response;
    } catch (error) {
        return contentError(error, "Не удалось обновить обращение");
    }
}
