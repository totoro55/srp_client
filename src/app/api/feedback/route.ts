import { contentError, contentOk } from "@/lib/content-response";
import { isFeedbackListScope } from "@/lib/content";
import { parseListPage } from "@/lib/list-page";
import { getActiveAccess } from "@/lib/require-admin";
import { createFeedback, listFeedback, readFeedbackRequest } from "@/services/feedback";

export async function GET(request: Request) {
    try {
        const access = await getActiveAccess();
        const params = new URL(request.url).searchParams;
        const scope = params.get("status");
        return contentOk(await listFeedback(
            access,
            params.get("q")?.trim() ?? "",
            isFeedbackListScope(scope) ? scope : "open",
            parseListPage(params.get("page")),
        ));
    } catch (error) {
        return contentError(error, "Не удалось загрузить обращения");
    }
}

export async function POST(request: Request) {
    try {
        const access = await getActiveAccess();
        const payload = await readFeedbackRequest(request);
        return contentOk(await createFeedback(access, payload.body, payload.files));
    } catch (error) {
        return contentError(error, "Не удалось создать обращение");
    }
}
