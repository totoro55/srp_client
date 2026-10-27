export const NEWS_TITLE_MAX = 200;
export const NEWS_BODY_MAX = 8000;

export const WIKI_TITLE_MAX = 300;
export const WIKI_HINT_MAX = 500;
export const WIKI_FIELD_MAX = 4000;
export const WIKI_TEXT_MAX = 200_000;
export const WIKI_TAG_MAX = 32;
export const WIKI_TAGS_MAX = 12;

export const ROADMAP_TITLE_MAX = 200;
export const ROADMAP_DESCRIPTION_MAX = 2000;
export const ROADMAP_STATUSES = ["done", "now", "later"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const ROADMAP_STATUS_LABELS: Record<RoadmapStatus, string> = {
    done: "Сделано",
    now: "В работе",
    later: "Дальше",
};

export const FEEDBACK_SUBJECT_MAX = 200;
export const FEEDBACK_BODY_MAX = 8000;
export const FEEDBACK_MESSAGE_MAX = 4000;
export const FEEDBACK_STATUSES = ["new", "progress", "waiting", "done", "declined"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
    new: "Новая",
    progress: "В работе",
    waiting: "Ожидает ответа",
    done: "Завершено",
    declined: "Отклонено",
};

export function isRoadmapStatus(value: unknown): value is RoadmapStatus {
    return typeof value === "string" && (ROADMAP_STATUSES as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
    return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export type FeedbackListScope = "open" | "all" | FeedbackStatus;

export const FEEDBACK_LIST_SCOPE_LABELS: Record<FeedbackListScope, string> = {
    open: "Незавершенные",
    all: "Все",
    ...FEEDBACK_STATUS_LABELS,
};

export function isFeedbackListScope(value: unknown): value is FeedbackListScope {
    return value === "open" || value === "all" || isFeedbackStatus(value);
}

export function boundedText(value: unknown, max: number, label: string): string | { error: string } {
    if (typeof value !== "string") {
        return { error: `${label} не заполнен` };
    }
    const text = value.trim();
    if (text.length === 0) {
        return { error: `${label} не заполнен` };
    }
    if (text.length > max) {
        return { error: `${label} длиннее ${max} символов` };
    }
    return text;
}

export function optionalText(value: unknown, max: number, label: string): string | { error: string } {
    if (value === undefined || value === null) {
        return "";
    }
    if (typeof value !== "string") {
        return { error: `${label} не заполнен` };
    }
    const text = value.trim();
    if (text.length > max) {
        return { error: `${label} длиннее ${max} символов` };
    }
    return text;
}

export function roleIds(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.length === 0) {
        return null;
    }
    const ids = value.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item > 0);
    if (ids.length !== value.length) {
        return null;
    }
    return [...new Set(ids)];
}
