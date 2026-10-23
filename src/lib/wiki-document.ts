export interface WikiHeading {
    id: string;
    text: string;
    level: 2 | 3;
}

export interface WikiMark {
    type: string;
    attrs?: Record<string, string>;
}

export interface WikiNode {
    type: string;
    attrs?: Record<string, unknown>;
    text?: string;
    marks?: WikiMark[];
    content?: WikiNode[];
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
    "image",
    "horizontalRule",
    "formula",
    "blockMath",
    "inlineMath",
]);

const MARKS = new Set(["bold", "italic", "strike", "code", "link"]);

const ASSET_SRC = /^\/api\/wiki\/assets\/[0-9a-f-]{36}$/i;

export function emptyWikiDocument(): WikiNode {
    return { type: "doc", content: [{ type: "paragraph" }] };
}

export function readWikiDocument(value: unknown): { document: WikiNode } | { error: string } {
    if (!value || typeof value !== "object") {
        return { error: "Текст статьи повреждён" };
    }
    const node = value as WikiNode;
    if (node.type !== "doc" || !Array.isArray(node.content)) {
        return { error: "Текст статьи повреждён" };
    }
    try {
        const document = sanitizeNode(node, true);
        stampHeadingIds(document);
        return { document };
    } catch (error) {
        return { error: error instanceof Error ? error.message : "Текст статьи повреждён" };
    }
}

export function wikiPlainText(document: WikiNode, extra: string[]): string {
    const parts = [...extra, collectText(document)];
    return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function wikiHeadings(document: WikiNode): WikiHeading[] {
    const headings: WikiHeading[] = [];
    walk(document, (node) => {
        if (node.type !== "heading") {
            return;
        }
        const level = node.attrs?.level;
        const id = node.attrs?.id;
        if ((level === 2 || level === 3) && typeof id === "string") {
            headings.push({ id, text: collectText(node), level });
        }
    });
    return headings;
}

function sanitizeNode(node: WikiNode, root: boolean): WikiNode {
    if (!BLOCKS.has(node.type) && node.type !== "text" && node.type !== "hardBreak") {
        throw new Error("В статье есть недопустимый блок");
    }
    if (root && node.type !== "doc") {
        throw new Error("Текст статьи повреждён");
    }

    if (node.type === "text") {
        if (typeof node.text !== "string") {
            throw new Error("Текст статьи повреждён");
        }
        return { type: "text", text: node.text, marks: sanitizeMarks(node.marks) };
    }

    if (node.type === "hardBreak" || node.type === "horizontalRule") {
        return { type: node.type };
    }

    const next: WikiNode = { type: node.type };
    if (node.type === "heading") {
        const level = node.attrs?.level === 3 ? 3 : 2;
        next.attrs = { level };
    }
    if (node.type === "image") {
        const src = node.attrs?.src;
        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 200) : "";
        if (typeof src !== "string" || !ASSET_SRC.test(src)) {
            throw new Error("Снимок можно вставить только из этой статьи");
        }
        next.attrs = { src, alt };
    }
    if (node.type === "blockMath" || node.type === "inlineMath") {
        const latex = typeof node.attrs?.latex === "string" ? node.attrs.latex.slice(0, 2000) : "";
        next.attrs = { latex };
    }
    if (node.type === "formula") {
        next.content = (node.content ?? []).map((child) => {
            if (child.type !== "text" || typeof child.text !== "string") {
                throw new Error("Формула содержит недопустимый блок");
            }
            return { type: "text", text: child.text.slice(0, 2000) };
        });
        return next;
    }

    if (node.content) {
        next.content = node.content.map((child) => sanitizeNode(child, false));
    }
    return next;
}

function sanitizeMarks(marks: WikiMark[] | undefined): WikiMark[] | undefined {
    if (!marks || marks.length === 0) {
        return undefined;
    }
    return marks.map((mark) => {
        if (!MARKS.has(mark.type)) {
            throw new Error("В статье есть недопустимое оформление");
        }
        if (mark.type !== "link") {
            return { type: mark.type };
        }
        const href = mark.attrs?.href ?? "";
        if (!safeHref(href)) {
            throw new Error("Ссылка ведёт на недопустимый адрес");
        }
        return { type: "link", attrs: { href } };
    });
}

function safeHref(href: string): boolean {
    if (href.startsWith("#") && /^#[\p{L}\p{N}-]+$/u.test(href)) {
        return true;
    }
    if (href.startsWith("/wiki/") && !href.includes("..")) {
        return true;
    }
    try {
        const url = new URL(href);
        return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:";
    } catch {
        return false;
    }
}

function stampHeadingIds(document: WikiNode): void {
    const used = new Set<string>();
    walk(document, (node) => {
        if (node.type !== "heading") {
            return;
        }
        const base = slug(collectText(node));
        let id = base;
        let index = 2;
        while (used.has(id)) {
            id = `${base}-${index}`;
            index += 1;
        }
        used.add(id);
        node.attrs = { ...(node.attrs ?? {}), id, level: node.attrs?.level === 3 ? 3 : 2 };
    });
}

function slug(text: string): string {
    const base = text
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^\p{L}\p{N}-]+/gu, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return base.slice(0, 80) || "razdel";
}

function collectText(node: WikiNode): string {
    if (node.type === "text") {
        return node.text ?? "";
    }
    if ((node.type === "blockMath" || node.type === "inlineMath") && typeof node.attrs?.latex === "string") {
        return node.attrs.latex;
    }
    const separator = node.type === "doc" ? "\n" : "";
    return (node.content ?? []).map(collectText).join(separator);
}

function walk(node: WikiNode, visit: (node: WikiNode) => void): void {
    visit(node);
    for (const child of node.content ?? []) {
        walk(child, visit);
    }
}
