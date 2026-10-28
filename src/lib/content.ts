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

export const FEEDBACK_KINDS = ["problem", "question", "suggestion"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = {
    problem: "Проблема",
    question: "Вопрос",
    suggestion: "Предложение",
};

export const FEEDBACK_CATEGORIES = ["wiki", "news", "bonus", "rrs", "baskets", "tariffs", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
    wiki: "База знаний",
    news: "Новости",
    bonus: "Расчёт премий",
    rrs: "Настройки РРС",
    baskets: "Корзины",
    tariffs: "Алгоритмы тарифов",
    other: "Другое",
};

export const FEEDBACK_ARTICLE_CATEGORY: FeedbackCategory = "wiki";

export function isFeedbackKind(value: unknown): value is FeedbackKind {
    return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
    return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
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
