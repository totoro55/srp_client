import { notifyError, notifySuccess } from "@/lib/notify";

type AnchorClick = {
    target: EventTarget | null;
    preventDefault: () => void;
    metaKey: boolean;
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    button: number;
};

export function wikiAnchorPath(articleId: number, anchorId: string): string {
    return `/wiki/${articleId}#${anchorId}`;
}

export function currentWikiHash(): string {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw) {
        return "";
    }
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

export function scrollToWikiAnchor(anchorId: string): boolean {
    const target = document.getElementById(anchorId);
    if (!target) {
        return false;
    }
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    target.scrollIntoView({ behavior, block: "start" });
    return true;
}

export async function copyWikiAnchorLink(pagePath: string, anchorId: string) {
    if (!pagePath || !anchorId) {
        notifyError("Сначала сохраните статью");
        return;
    }
    const url = new URL(pagePath, window.location.origin);
    url.hash = anchorId;
    try {
        await navigator.clipboard.writeText(url.toString());
        notifySuccess("Ссылка скопирована");
    } catch {
        notifyError("Не удалось скопировать ссылку");
    }
}

export function followAnchorLink(event: AnchorClick) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
    }
    const source = event.target instanceof Element ? event.target.closest("a") : null;
    const href = source?.getAttribute("href");
    if (!href) {
        return;
    }
    const id = anchorIdFromHref(href);
    if (!id || !document.getElementById(id)) {
        return;
    }
    event.preventDefault();
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
    scrollToWikiAnchor(id);
}

function anchorIdFromHref(href: string): string | null {
    if (href.startsWith("#")) {
        return currentHashValue(href.slice(1));
    }
    try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) {
            return null;
        }
        return currentHashValue(url.hash.slice(1));
    } catch {
        return null;
    }
}

function currentHashValue(raw: string): string {
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}
