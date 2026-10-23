import { contentError, contentOk } from "@/lib/content-response";
import { can } from "@/lib/access";
import { getActiveAccess, requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { addFeedbackMessage, getFeedback, readFeedbackRequest, setFeedbackHandling } from "@/services/feedback";

interface Context {
    params: Promise<{ id: string }>;
}

async function ticketId(context: Context): Promise<number> {
    const id = Number((await context.params).id);
    if (!Number.isInteger(id)) {
        throw new ContentError("Обращение не найдено");
    }
    return id;
}

export async function GET(_request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        return contentOk(await getFeedback(access, await ticketId(context)));
    } catch (error) {
        return contentError(error, "Не удалось загрузить обращение");
    }
}

export async function POST(request: Request, context: Context) {
    try {
        const access = await getActiveAccess();
        const payload = await readFeedbackRequest(request);
        return contentOk(await addFeedbackMessage(
            access,
            await ticketId(context),
            payload.body,
            payload.files,
            payload.status,
            payload.action,
            payload.assignee,
        ));
    } catch (error) {
        return contentError(error, "Не удалось отправить ответ");
    }
}

export async function PATCH(request: Request, context: Context) {
    try {
        const access = await requirePermission("feedback:process");
        if (!can(access, "feedback:process")) {
            throw new ContentError("Обращение не найдено");
        }
        return contentOk(await setFeedbackHandling(access, await ticketId(context), await request.json()));
    } catch (error) {
        return contentError(error, "Не удалось сменить статус");
    }
}
