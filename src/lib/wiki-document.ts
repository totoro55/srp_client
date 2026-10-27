import { newsPlainText, readNewsDocument, type DocumentRules, type NewsNode } from "@/lib/news-document";

export interface WikiHeading {
    id: string;
    text: string;
    level: 2 | 3;
}

export type WikiNode = NewsNode;

const WIKI_ASSET_SRC = /^\/api\/wiki\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const WIKI_RULES: DocumentRules = {
    assetRoot: "/api/wiki/assets",
    assetPattern: WIKI_ASSET_SRC,
    allowHref: wikiHref,
    allowAnchors: true,
};

export function emptyWikiDocument(): WikiNode {
    return { type: "doc", content: [{ type: "paragraph" }] };
}

export function readWikiDocument(value: unknown): { document: WikiNode } | { error: string } {
    const result = readNewsDocument(legacyFormula(value), WIKI_RULES);
    if ("error" in result) {
        return { error: articleError(result.error) };
    }
    stampHeadingIds(result.document);
    stampAnchorIds(result.document);
    return { document: result.document };
}

export function wikiPlainText(document: WikiNode, extra: string[]): string {
    return [...extra, newsPlainText(document)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function wikiAnchorSlug(text: string): string {
    return slug(text);
}

export function wikiHeadings(document: WikiNode): WikiHeading[] {
    const headings: WikiHeading[] = [];
    walk(document, (node) => {
        if (node.type !== "wikiAnchor" || typeof node.attrs?.id !== "string" || node.attrs.id.length === 0) {
            return;
        }
        headings.push({ id: node.attrs.id, text: collectText(node).trim() || "Раздел", level: 2 });
    });
    return headings;
}

export function wikiAssetIds(document: WikiNode): string[] {
    const ids = new Set<string>();
    walk(document, (node) => {
        if (node.type !== "image" && node.type !== "fileAttachment") {
            return;
        }
        const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
        const match = WIKI_ASSET_SRC.exec(src);
        if (match?.[1]) {
            ids.add(match[1].toLowerCase());
        }
    });
    return [...ids];
}

function legacyFormula(value: unknown): unknown {
    if (!value || typeof value !== "object") {
        return value;
    }
    const node = value as WikiNode;
    const content = Array.isArray(node.content) ? node.content.map((child) => legacyFormula(child) as WikiNode) : undefined;
    if (node.type !== "formula") {
        return content ? { ...node, content } : node;
    }
    const latex = (content ?? [])
        .map((child) => child.type === "text" && typeof child.text === "string" ? child.text : "")
        .join("")
        .slice(0, 2000);
    if ((content ?? []).some((child) => child.type !== "text")) {
        return content ? { ...node, content } : node;
    }
    return { type: "blockMath", attrs: { latex } };
}

function articleError(message: string): string {
    return message
        .replaceAll("Текст новости", "Текст статьи")
        .replaceAll("В новости", "В статье")
        .replaceAll("новости", "статьи")
        .replaceAll("новость", "статья");
}

function wikiHref(href: string): boolean {
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

function stampAnchorIds(document: WikiNode): void {
    const used = new Set<string>();
    walk(document, (node) => {
        if (node.type !== "wikiAnchor") {
            return;
        }
        const current = typeof node.attrs?.id === "string" ? node.attrs.id : "";
        const base = /^[\p{L}\p{N}][\p{L}\p{N}-]{0,79}$/u.test(current) ? current : slug(collectText(node));
        let id = base;
        let index = 2;
        while (used.has(id)) {
            id = `${base}-${index}`.slice(0, 80);
            index += 1;
        }
        used.add(id);
        node.attrs = { id };
    });
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
    return (node.content ?? []).map(collectText).join("");
}

function walk(node: WikiNode, visit: (node: WikiNode) => void): void {
    visit(node);
    for (const child of node.content ?? []) {
        walk(child, visit);
    }
}
