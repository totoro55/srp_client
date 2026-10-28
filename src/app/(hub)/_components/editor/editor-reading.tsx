"use client";

import { type NewsNode } from "@/lib/news-document";
import { type ReadingMedia } from "@/components/reading-media";
import { EDITOR_ASSET_SRC } from "./editor-schema";

export function nextAnchorId(document: NewsNode, base: string): string {
    const used = new Set(anchorItems(document).map((item) => item.id));
    let id = base;
    let index = 2;
    while (used.has(id)) {
        id = `${base}-${index}`.slice(0, 80);
        index += 1;
    }
    return id;
}

export function anchorItems(document: NewsNode): { id: string; text: string }[] {
    const items: { id: string; text: string }[] = [];
    const walk = (node: NewsNode) => {
        if (node.type === "wikiAnchor" && typeof node.attrs?.id === "string" && node.attrs.id.length > 0) {
            const text = (node.content ?? []).map((child) => child.text ?? "").join("").trim();
            items.push({ id: node.attrs.id, text: text || "Раздел" });
        }
        for (const child of node.content ?? []) {
            walk(child);
        }
    };
    walk(document);
    return items;
}

export function openReadingMedia(event: { target: EventTarget | null; preventDefault: () => void; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; button: number }, open: (item: ReadingMedia) => void) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
    }
    const target = event.target instanceof Element ? event.target : null;
    const image = target?.closest("img");
    if (image instanceof HTMLImageElement) {
        const src = image.getAttribute("src") ?? "";
        if (!EDITOR_ASSET_SRC.test(src)) {
            return;
        }
        event.preventDefault();
        open({ src, title: image.alt || "Снимок", mime: "image/*" });
        return;
    }
    const link = target?.closest("a[data-attachment]");
    if (!(link instanceof HTMLAnchorElement)) {
        return;
    }
    const src = link.getAttribute("href") ?? "";
    if (!EDITOR_ASSET_SRC.test(src)) {
        return;
    }
    event.preventDefault();
    open({
        src,
        title: link.getAttribute("data-title") || (link.textContent ?? "").trim() || "Вложение",
        mime: link.getAttribute("data-mime") ?? "",
    });
}
