export const FEEDBACK_FILE_MAX_MB_MIN = 1;
export const FEEDBACK_FILE_MAX_MB_MAX = 50;
export const FEEDBACK_FILE_COUNT_MIN = 1;
export const FEEDBACK_FILE_COUNT_MAX = 10;
export const DEFAULT_FEEDBACK_FILE_MAX_MB = 20;
export const DEFAULT_FEEDBACK_FILE_MAX_COUNT = 5;

export interface FeedbackFileKind {
    id: string;
    extensions: string[];
    label: string;
    mime: string;
}

export const FEEDBACK_FILE_KINDS: FeedbackFileKind[] = [
    { id: "png", extensions: ["png"], label: "PNG", mime: "image/png" },
    { id: "jpeg", extensions: ["jpg", "jpeg"], label: "JPEG", mime: "image/jpeg" },
    { id: "webp", extensions: ["webp"], label: "WEBP", mime: "image/webp" },
    { id: "gif", extensions: ["gif"], label: "GIF", mime: "image/gif" },
    { id: "pdf", extensions: ["pdf"], label: "PDF", mime: "application/pdf" },
    { id: "txt", extensions: ["txt"], label: "текст", mime: "text/plain" },
    { id: "docx", extensions: ["docx"], label: "Word", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { id: "xlsx", extensions: ["xlsx"], label: "Excel", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
];

const ALLOWED_EXTENSIONS = new Set(FEEDBACK_FILE_KINDS.flatMap((kind) => kind.extensions));

export const DEFAULT_FEEDBACK_FILE_EXTENSIONS = FEEDBACK_FILE_KINDS.flatMap((kind) => kind.extensions).join(",");

export function parseFeedbackExtensions(value: string): string[] {
    const found = value
        .split(/[,;\s]+/)
        .map((item) => item.trim().toLowerCase().replace(/^\./, ""))
        .filter((item) => ALLOWED_EXTENSIONS.has(item));
    return [...new Set(found)];
}

export function feedbackFileMime(extension: string): string | null {
    return FEEDBACK_FILE_KINDS.find((kind) => kind.extensions.includes(extension))?.mime ?? null;
}

export function feedbackFileAccept(extensions: string[]): string {
    const selected = new Set(extensions);
    const parts = new Set<string>();
    for (const kind of FEEDBACK_FILE_KINDS) {
        if (!kind.extensions.some((extension) => selected.has(extension))) {
            continue;
        }
        parts.add(kind.mime);
        for (const extension of kind.extensions) {
            parts.add(`.${extension}`);
        }
    }
    return [...parts].join(",");
}

export function feedbackFileHint(maxMb: number, maxCount: number, extensions: string[]): string {
    const selected = new Set(extensions);
    const labels = FEEDBACK_FILE_KINDS
        .filter((kind) => kind.extensions.some((extension) => selected.has(extension)))
        .map((kind) => kind.label);
    const kinds = labels.length > 0 ? labels.join(", ") : "файлы выбранных типов";
    const count = maxCount === 1 ? "один файл" : `не больше ${maxCount} файлов`;
    return `Можно приложить ${kinds}. За раз ${count}, каждый не больше ${maxMb} МБ.`;
}

export function feedbackExtension(filename: string): string {
    const base = filename.split(/[/\\]/).pop() ?? "";
    const extension = base.includes(".") ? base.split(".").pop()?.toLowerCase() ?? "" : "";
    return extension === base.toLowerCase() ? "" : extension;
}
