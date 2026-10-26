import { newsBorderWidth, newsColor, newsFontSize, newsImageAlign } from "@/lib/news-format";

export interface NewsMark {
    type: string;
    attrs?: Record<string, string>;
}

export interface NewsNode {
    type: string;
    attrs?: Record<string, unknown>;
    text?: string;
    marks?: NewsMark[];
    content?: NewsNode[];
}

const BLOCKS = new Set([
    "doc",
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "listItem",
    "blockquote",
    "table",
    "tableRow",
    "tableHeader",
    "tableCell",
    "codeBlock",
]);

const MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link", "textStyle", "highlight"]);

const FILLABLE = new Set(["paragraph", "heading", "blockquote", "listItem", "tableCell", "tableHeader", "codeBlock"]);

export const NEWS_ASSET_SRC = /^\/api\/news\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function newsAssetId(src: string): string | null {
    const match = NEWS_ASSET_SRC.exec(src);
    return match ? match[1].toLowerCase() : null;
}

export function newsAssetIds(document: NewsNode): string[] {
    const ids = new Set<string>();
    const walk = (node: NewsNode) => {
        if (node.type === "image" || node.type === "fileAttachment") {
            const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
            const id = newsAssetId(src);
            if (id) {
                ids.add(id);
            }
        }
        for (const child of node.content ?? []) {
            walk(child);
        }
    };
    walk(document);
    return [...ids];
}

export function emptyNewsDocument(): NewsNode {
    return { type: "doc", content: [{ type: "paragraph" }] };
}

export function plainTextDocument(text: string): NewsNode {
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    return {
        type: "doc",
        content: lines.map((line) => (
            line.length > 0
                ? { type: "paragraph", content: [{ type: "text", text: line }] }
                : { type: "paragraph" }
        )),
    };
}

export function readNewsDocument(value: unknown): { document: NewsNode } | { error: string } {
    if (!value || typeof value !== "object") {
        return { error: "Текст новости повреждён" };
    }
    const node = value as NewsNode;
    if (node.type !== "doc" || !Array.isArray(node.content)) {
        return { error: "Текст новости повреждён" };
    }
    try {
        return { document: sanitizeNode(node, true, 0) };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Текст новости повреждён" };
    }
}

export function newsPlainText(document: NewsNode): string {
    return collectText(document).replace(/\n{3,}/g, "\n\n").trim();
}

function sanitizeNode(node: NewsNode, root: boolean, depth: number): NewsNode {
    if (depth > 30) {
        throw new Error("Текст новости слишком большой");
    }
    if (node.type === "text") {
        if (typeof node.text !== "string") {
            throw new Error("Текст новости повреждён");
        }
        return { type: "text", text: node.text, marks: sanitizeMarks(node.marks) };
    }
    if (node.type === "hardBreak") {
        return { type: "hardBreak" };
    }
    if (node.type === "horizontalRule") {
        return { type: "horizontalRule" };
    }
    if (node.type === "blockMath" || node.type === "inlineMath") {
        const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex.slice(0, 2000) : "";
        return { type: node.type, attrs: { latex } };
    }
    if (node.type === "image") {
        const width = pixel(node.attrs?.width, 1, 4000);
        const height = pixel(node.attrs?.height, 1, 4000);
        const borderColor = newsColor(node.attrs?.borderColor);
        const borderWidth = newsBorderWidth(node.attrs?.borderWidth);
        const align = newsImageAlign(node.attrs?.align);
        return {
            type: "image",
            attrs: {
                src: assetSrc(node.attrs?.src, "Снимок ведёт на недопустимый адрес"),
                alt: typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 200) : "",
                ...(width ? { width } : {}),
                ...(height ? { height } : {}),
                ...(borderColor ? { borderColor, borderWidth: borderWidth ?? 2 } : {}),
                ...(align ? { align } : {}),
            },
        };
    }
    if (node.type === "fileAttachment") {
        const mime = typeof node.attrs?.mime === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(node.attrs.mime)
            ? node.attrs.mime.slice(0, 100)
            : "";
        return {
            type: "fileAttachment",
            attrs: {
                src: assetSrc(node.attrs?.src, "Вложение ведёт на недопустимый адрес"),
                title: typeof node.attrs?.title === "string" ? node.attrs.title.slice(0, 255) : "",
                mime,
            },
        };
    }
    if (!BLOCKS.has(node.type)) {
        throw new Error("В новости есть недопустимый блок");
    }
    if (root && node.type !== "doc") {
        throw new Error("Текст новости повреждён");
    }
    const next: NewsNode = { type: node.type };
    if (node.type === "heading") {
        next.attrs = { level: node.attrs?.level === 3 ? 3 : 2 };
    }
    if (node.type === "tableRow") {
        const height = pixel(node.attrs?.height, 28, 2000);
        if (height) {
            next.attrs = { height };
        }
    }
    if (node.type === "tableCell" || node.type === "tableHeader") {
        const widths = columnWidths(node.attrs?.colwidth);
        next.attrs = {
            colspan: span(node.attrs?.colspan),
            rowspan: span(node.attrs?.rowspan),
            ...(widths ? { colwidth: widths } : {}),
        };
    }
    if (node.type === "codeBlock") {
        const language = languageOf(node.attrs?.language);
        if (language) {
            next.attrs = { language };
        }
    }
    if (node.content) {
        if (!Array.isArray(node.content)) {
            throw new Error("Текст новости повреждён");
        }
        next.content = node.content.map((child) => sanitizeNode(child, false, depth + 1));
    }
    mergeFill(next, node);
    return next;
}

function mergeFill(next: NewsNode, source: NewsNode) {
    if (!FILLABLE.has(next.type)) {
        return;
    }
    const color = newsColor(source.attrs?.backgroundColor);
    if (!color) {
        return;
    }
    next.attrs = { ...(next.attrs ?? {}), backgroundColor: color };
}

function sanitizeMarks(marks: NewsMark[] | undefined): NewsMark[] | undefined {
    if (!marks || marks.length === 0) {
        return undefined;
    }
    const next = marks.flatMap((mark) => {
        const sanitized = sanitizeMark(mark);
        return sanitized ? [sanitized] : [];
    });
    return next.length > 0 ? next : undefined;
}

function sanitizeMark(mark: NewsMark): NewsMark | undefined {
    if (!MARKS.has(mark.type)) {
        throw new Error("В новости есть недопустимое оформление");
    }
    if (mark.type === "link") {
        const href = mark.attrs?.href ?? "";
        if (!safeHref(href)) {
            throw new Error("Ссылка ведёт на недопустимый адрес");
        }
        return { type: "link", attrs: { href: href.slice(0, 2000) } };
    }
    if (mark.type === "textStyle") {
        const color = newsColor(mark.attrs?.color);
        const fontSize = newsFontSize(mark.attrs?.fontSize);
        if (!color && !fontSize) {
            return undefined;
        }
        return {
            type: "textStyle",
            attrs: {
                ...(color ? { color } : {}),
                ...(fontSize ? { fontSize } : {}),
            },
        };
    }
    if (mark.type === "highlight") {
        const color = newsColor(mark.attrs?.color);
        return color ? { type: "highlight", attrs: { color } } : { type: "highlight" };
    }
    return { type: mark.type };
}

function assetSrc(value: unknown, message: string): string {
    if (typeof value !== "string") {
        throw new Error(message);
    }
    const id = newsAssetId(value);
    if (!id) {
        throw new Error(message);
    }
    return `/api/news/assets/${id}`;
}

function span(value: unknown): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
        return 1;
    }
    return Math.min(value, 20);
}

function pixel(value: unknown, min: number, max: number): number | undefined {
    const number = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim() !== ""
            ? Number(value)
            : Number.NaN;
    if (!Number.isFinite(number)) {
        return undefined;
    }
    const rounded = Math.round(number);
    if (rounded < min || rounded > max) {
        return undefined;
    }
    return rounded;
}

function columnWidths(value: unknown): number[] | undefined {
    if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
        return undefined;
    }
    const widths: number[] = [];
    for (const item of value) {
        const width = pixel(item, 25, 2000);
        if (!width) {
            return undefined;
        }
        widths.push(width);
    }
    return widths;
}

function languageOf(value: unknown): string | undefined {
    if (typeof value !== "string" || !/^[a-z0-9#+.-]{1,32}$/i.test(value.trim())) {
        return undefined;
    }
    return value.trim();
}

function safeHref(href: string): boolean {
    try {
        const url = new URL(href);
        return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
    } catch {
        return false;
    }
}

function collectText(node: NewsNode): string {
    if (node.type === "text") {
        return node.text ?? "";
    }
    if (node.type === "hardBreak" || node.type === "horizontalRule") {
        return "\n";
    }
    if (node.type === "image") {
        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.trim() : "";
        return alt ? `${alt}\n` : "";
    }
    if (node.type === "fileAttachment") {
        const title = typeof node.attrs?.title === "string" ? node.attrs.title.trim() : "";
        return title ? `${title}\n` : "";
    }
    if (node.type === "blockMath" || node.type === "inlineMath") {
        const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex.trim() : "";
        return latex ? `${latex}\n` : "";
    }
    const inner = (node.content ?? []).map(collectText).join("");
    if (node.type === "doc") {
        return inner;
    }
    return `${inner}\n`;
}
