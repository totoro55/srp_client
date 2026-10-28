import { contentError, contentOk } from "@/lib/content-response";
import { FEEDBACK_STATUSES, isFeedbackCategory, isFeedbackKind, type FeedbackStatus } from "@/lib/content";
import { parseListPage } from "@/lib/list-page";
import { getActiveAccess, requirePermission } from "@/lib/require-admin";
import { createFeedback, listFeedback, readFeedbackRequest } from "@/services/feedback";

export async function GET(request: Request) {
    try {
        const access = await getActiveAccess();
        const params = new URL(request.url).searchParams;
        const statuses = statusFilter(repeated(params, "status"));
        return contentOk(await listFeedback(
            access,
            params.get("q")?.trim() ?? "",
            statuses,
            classFilters(repeated(params, "kind"), isFeedbackKind),
            classFilters(repeated(params, "category"), isFeedbackCategory),
            parseListPage(params.get("page")),
        ));
    } catch (error) {
        return contentError(error, "Не удалось загрузить обращения");
    }
}

const OPEN_STATUSES: FeedbackStatus[] = ["new", "progress", "waiting"];

function repeated(params: URLSearchParams, key: string): string[] {
    return params.getAll(key).flatMap((item) => item.split(",")).map((item) => item.trim()).filter((item) => item !== "");
}

function statusFilter(values: string[]): FeedbackStatus[] {
    if (values.length === 0 || (values.length === 1 && values[0] === "open")) {
        return OPEN_STATUSES;
    }
    if (values.includes("all")) {
        return [];
    }
    return FEEDBACK_STATUSES.filter((status) => values.includes(status));
}

function classFilters(values: string[], isValue: (value: unknown) => boolean): string[] {
    return [...new Set(values.filter((value) => value === "none" || isValue(value)))];
}

export async function POST(request: Request) {
    try {
        const access = await requirePermission("feedback:write");
        const payload = await readFeedbackRequest(request);
        return contentOk(await createFeedback(access, payload.body, payload.files));
    } catch (error) {
        return contentError(error, "Не удалось создать обращение");
    }
}
