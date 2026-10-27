const IMAGE_MIME = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
} as const;

const FILE_MIME = {
    ...IMAGE_MIME,
    pdf: "application/pdf",
    txt: "text/plain",
    csv: "text/csv",
    md: "text/plain",
    log: "text/plain",
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    tar: "application/x-tar",
    gz: "application/gzip",
    tgz: "application/gzip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export const IMAGE_TYPES = new Set<string>(Object.values(IMAGE_MIME));
export const FILE_TYPES = new Set<string>(Object.values(FILE_MIME));

const MIME_ALIASES: Record<string, string> = {
    "application/x-zip-compressed": "application/zip",
    "application/x-zip": "application/zip",
    "application/x-rar-compressed": "application/vnd.rar",
    "application/x-rar": "application/vnd.rar",
    "application/x-7z-compressed": "application/x-7z-compressed",
    "application/x-gzip": "application/gzip",
    "application/gzip": "application/gzip",
    "application/x-compressed": "application/gzip",
    "application/x-tar": "application/x-tar",
    "text/markdown": "text/plain",
    "text/x-log": "text/plain",
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
};

export function fileExtension(name: string): string {
    const base = name.split(/[/\\]/).pop() ?? "";
    const dot = base.lastIndexOf(".");
    if (dot <= 0 || dot === base.length - 1) {
        return "";
    }
    return base.slice(dot + 1).toLowerCase();
}

export function normalizeUpload(file: { name: string; type: string }, kind: "image" | "file"): string | null {
    const table = kind === "image" ? IMAGE_MIME : FILE_MIME;
    const allowed = kind === "image" ? IMAGE_TYPES : FILE_TYPES;
    const extension = fileExtension(file.name);
    const fromName = extension in table ? table[extension as keyof typeof table] : undefined;
    if (fromName && allowed.has(fromName)) {
        return fromName;
    }
    const raw = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
    const aliased = MIME_ALIASES[raw] ?? raw;
    return allowed.has(aliased) ? aliased : null;
}

export function uploadAccept(kind: "image" | "file"): string {
    const table = kind === "image" ? IMAGE_MIME : FILE_MIME;
    const extensions = Object.keys(table).map((extension) => `.${extension}`);
    return [...new Set(Object.values(table)), ...extensions].join(",");
}

export function uploadRejectMessage(kind: "image" | "file"): string {
    return kind === "image"
        ? "Нужен снимок в PNG, JPEG, WEBP или GIF"
        : "Этот тип файла не поддерживается. Подойдут документы, таблицы, презентации, PDF, текст и архивы ZIP, RAR, 7z, TAR и GZ";
}

export type FileGlyph = "image" | "pdf" | "sheet" | "slides" | "archive" | "text" | "word" | "file";

export function fileGlyph(mime: string, name: string): FileGlyph {
    const type = mime.toLowerCase();
    const extension = fileExtension(name);
    if (type.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension)) {
        return "image";
    }
    if (type === "application/pdf" || extension === "pdf") {
        return "pdf";
    }
    if (type.includes("spreadsheet") || type === "application/vnd.ms-excel" || extension === "xls" || extension === "xlsx") {
        return "sheet";
    }
    if (type.includes("presentation") || type === "application/vnd.ms-powerpoint" || extension === "ppt" || extension === "pptx") {
        return "slides";
    }
    if (
        type.includes("zip")
        || type.includes("rar")
        || type.includes("7z")
        || type.includes("gzip")
        || type.includes("tar")
        || ["zip", "rar", "7z", "tar", "gz", "tgz"].includes(extension)
    ) {
        return "archive";
    }
    if (type.startsWith("text/") || ["txt", "md", "log", "csv"].includes(extension)) {
        return "text";
    }
    if (type.includes("word") || extension === "doc" || extension === "docx") {
        return "word";
    }
    return "file";
}

export function fileGlyphLabel(glyph: FileGlyph): string {
    switch (glyph) {
        case "image":
            return "Изображение";
        case "pdf":
            return "PDF";
        case "sheet":
            return "Таблица";
        case "slides":
            return "Презентация";
        case "archive":
            return "Архив";
        case "text":
            return "Текст";
        case "word":
            return "Документ";
        case "file":
            return "Файл";
    }
}
