import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { ContentError } from "@/services/content-error";
import { deleteFeedbackMessage, updateFeedbackMessage } from "@/services/feedback";

interface Context {
    params: Promise<{ id: string; messageId: string }>;
}

async function ids(context: Context): Promise<{ ticketId: number; messageId: number }> {
    const params = await context.params;
    const ticketId = Number(params.id);
    const messageId = Number(params.messageId);
    if (!Number.isInteger(ticketId) || !Number.isInteger(messageId)) {
        throw new ContentError("Сообщение не найдено");
    }
    return { ticketId, messageId };
}

export async function PATCH(request: Request, context: Context) {
    try {
        const access = await requirePermission("feedback:process");
        const { ticketId, messageId } = await ids(context);
        const edit = await readMessageEdit(request);
        return contentOk(await updateFeedbackMessage(access, ticketId, messageId, edit.body, edit.files, edit.keep));
    } catch (error) {
        return contentError(error, "Не удалось изменить сообщение");
    }
}

async function readMessageEdit(request: Request): Promise<{ body: unknown; files: File[]; keep: string[] | null }> {
    const type = request.headers.get("content-type") ?? "";
    if (!type.includes("multipart/form-data")) {
        return { body: await request.json() as unknown, files: [], keep: null };
    }
    const form = await request.formData();
    const record: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
        if (typeof value === "string" && key !== "keep") {
            record[key] = value;
        }
    }
    const keep = form.getAll("keep").filter((item): item is string => typeof item === "string");
    const files = form.getAll("file").filter((item): item is File => item instanceof File && item.size > 0);
    return { body: record, files, keep };
}

export async function DELETE(_request: Request, context: Context) {
    try {
        const access = await requirePermission("feedback:process");
        const { ticketId, messageId } = await ids(context);
        return contentOk(await deleteFeedbackMessage(access, ticketId, messageId));
    } catch (error) {
        return contentError(error, "Не удалось удалить сообщение");
    }
}
