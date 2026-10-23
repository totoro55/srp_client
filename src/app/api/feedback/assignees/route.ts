import { contentError, contentOk } from "@/lib/content-response";
import { requirePermission } from "@/lib/require-admin";
import { listFeedbackAssignees } from "@/services/feedback";

export async function GET(request: Request) {
    try {
        const access = await requirePermission("feedback:process");
        const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
        return contentOk(await listFeedbackAssignees(access, query));
    } catch (error) {
        return contentError(error, "Не удалось найти сотрудников");
    }
}
