"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ArrowUpDown, Calendar, ChevronsDownUp, ChevronsUpDown, ChevronRight, Clock, CornerUpLeft, FilePlus, FileText, Folder, FolderOpen, FolderPlus, GripVertical, House, Info, List, PanelLeftClose, PanelLeftOpen, Pencil, Search, Send, Star, Trash2, UserRound, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormAlert } from "@/components/form-alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { ConfirmDialog } from "@/app/admin/_components/ConfirmDialog";
import { useAccess } from "@/hooks/useAccess";
import { cn } from "@/lib/utils";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";
import { currentWikiHash, scrollToWikiAnchor } from "@/lib/wiki-anchor";
import { NewsEditor } from "../../news/_components/NewsEditor";
import { ArticleBrief } from "./ArticleBrief";
import { WikiToc } from "./WikiEditor";
import { WikiSearchDialog } from "./WikiSearchDialog";
import type { WikiHeading, WikiNode } from "@/lib/wiki-document";

const TREE_WIDTH_KEY = "wiki.tree.width";
const TREE_CLOSED_KEY = "wiki.tree.closed";
const TREE_COLLAPSED_KEY = "wiki.tree.collapsed";
const FAVORITES_CLOSED_KEY = "wiki.favorites.closed";
const TREE_DEFAULT = 272;
const TREE_MIN = 200;
const TREE_MAX = 480;

interface WikiGroup {
    id: number;
    parentId: number | null;
    title: string;
    roleIds: number[];
}

interface WikiArticleSummary {
    id: number;
    groupId: number;
    title: string;
    basketVersionId: number | null;
    status: "draft" | "published";
    archived: boolean;
    tags: string[];
}

interface WikiArticle extends WikiArticleSummary {
    document: WikiNode;
    headings: WikiHeading[];
    publishedAt: string;
    updatedAt: string;
    author: string;
    authorName: string | null;
    authorTitle: string | null;
    summary: string;
}

interface WikiOrderPayload {
    groups: { parentId: number | null; ids: number[] }[];
    articles: { groupId: number; ids: number[] }[];
}

export function WikiDesk() {
    const params = useParams<{ id?: string }>();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const access = useAccess();
    const canWrite = access.has("wiki:write");
    const urlQuery = searchParams.get("q") ?? "";
    const tag = searchParams.get("tag") ?? "";
    const articleId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;
    const groupParam = searchParams.get("group");
    const browseGroupId = articleId === null && groupParam !== null && /^\d+$/.test(groupParam) ? Number(groupParam) : null;
    const [query, setQuery] = useState(urlQuery);
    const [groups, setGroups] = useState<WikiGroup[]>([]);
    const [articles, setArticles] = useState<WikiArticleSummary[]>([]);
    const [favorites, setFavorites] = useState<WikiArticleSummary[]>([]);
    const [favoriteBusy, setFavoriteBusy] = useState<number | null>(null);
    const [favoritesClosed, setFavoritesClosed] = useState(false);
    const [tags, setTags] = useState<string[]>([]);
    const [article, setArticle] = useState<WikiArticle | null>(null);
    const [closed, setClosed] = useState<Set<number>>(new Set());
    const [treeWidth, setTreeWidth] = useState(TREE_DEFAULT);
    const [treeCollapsed, setTreeCollapsed] = useState(false);
    const [prefsReady, setPrefsReady] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [articleReady, setArticleReady] = useState(articleId === null);
    const [error, setError] = useState<string | null>(null);
    const [groupOpen, setGroupOpen] = useState(false);
    const [groupParent, setGroupParent] = useState<number | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [tocOpen, setTocOpen] = useState(false);
    const [confirm, setConfirm] = useState<null | "archive" | "restore" | "delete">(null);
    const [pending, setPending] = useState(false);
    const [sorting, setSorting] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const articleScrollRef = useRef<HTMLDivElement>(null);
    const filterExpanded = useRef("");
    const showing = article && article.id === articleId ? article : null;
    const listed = articles.find((item) => item.id === articleId) ?? null;
    const crumbTitle = showing?.title ?? listed?.title ?? null;
    const crumbGroupId = showing?.groupId ?? listed?.groupId ?? null;
    const browseGroup = browseGroupId === null ? null : groups.find((group) => group.id === browseGroupId) ?? null;
    useEffect(() => {
        const storedWidth = window.localStorage.getItem(TREE_WIDTH_KEY);
        const width = storedWidth === null ? Number.NaN : Number(storedWidth);
        if (Number.isFinite(width) && width > 0) {
            setTreeWidth(clampWidth(width));
        }
        setTreeCollapsed(window.localStorage.getItem(TREE_COLLAPSED_KEY) === "1");
        setFavoritesClosed(window.localStorage.getItem(FAVORITES_CLOSED_KEY) === "1");
        const storedClosed = window.localStorage.getItem(TREE_CLOSED_KEY);
        if (storedClosed) {
            try {
                const parsed = JSON.parse(storedClosed) as unknown;
                if (Array.isArray(parsed)) {
                    setClosed(new Set(parsed.filter((item): item is number => typeof item === "number")));
                }
            } catch {
                window.localStorage.removeItem(TREE_CLOSED_KEY);
            }
        }
        setPrefsReady(true);
    }, []);

    useEffect(() => {
        if (!prefsReady) {
            return;
        }
        window.localStorage.setItem(TREE_WIDTH_KEY, String(treeWidth));
        window.localStorage.setItem(TREE_COLLAPSED_KEY, treeCollapsed ? "1" : "0");
        window.localStorage.setItem(TREE_CLOSED_KEY, JSON.stringify([...closed]));
        window.localStorage.setItem(FAVORITES_CLOSED_KEY, favoritesClosed ? "1" : "0");
    }, [prefsReady, treeWidth, treeCollapsed, closed, favoritesClosed]);

    useEffect(() => {
        setQuery(urlQuery);
    }, [urlQuery]);

    useEffect(() => {
        if (query === urlQuery) {
            return;
        }
        const timer = window.setTimeout(() => {
            replaceFilter(query, tag);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [query, urlQuery, tag]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load(urlQuery, tag);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [urlQuery, tag]);

    useEffect(() => {
        if (!showing) {
            return;
        }
        const headings = showing.headings;
        let timer = 0;
        let attempts = 0;
        function go() {
            const id = currentWikiHash();
            if (!id || !headings.some((item) => item.id === id)) {
                return;
            }
            if (scrollToWikiAnchor(id)) {
                return;
            }
            attempts += 1;
            if (attempts < 20) {
                timer = window.setTimeout(go, 50);
            }
        }
        go();
        function onHistory() {
            attempts = 0;
            window.clearTimeout(timer);
            go();
        }
        window.addEventListener("hashchange", onHistory);
        window.addEventListener("popstate", onHistory);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("hashchange", onHistory);
            window.removeEventListener("popstate", onHistory);
        };
    }, [showing]);

    useEffect(() => {
        setMobileOpen(false);
        setTocOpen(false);
    }, [articleId]);

    useEffect(() => {
        const media = window.matchMedia("(min-width: 1024px)");
        function onChange() {
            if (media.matches) {
                setMobileOpen(false);
                setTocOpen(false);
            }
        }
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    useEffect(() => {
        if (!mobileOpen) {
            return;
        }
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        function onKey(event: globalThis.KeyboardEvent) {
            if (event.key === "Escape" && !groupOpen && !sorting && !searchOpen && confirm === null) {
                setMobileOpen(false);
            }
        }
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKey);
        };
    }, [mobileOpen, groupOpen, sorting, searchOpen, confirm]);

    useEffect(() => {
        if (articleId === null) {
            return;
        }
        const timer = window.setTimeout(() => {
            setArticleReady(false);
            void openArticle(articleId);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [articleId]);

    useEffect(() => {
        if (!prefsReady || !loaded || articleId === null) {
            return;
        }
        const current = articles.find((item) => item.id === articleId);
        if (!current) {
            return;
        }
        const chain = groupChain(current.groupId, groups);
        setClosed((existing) => {
            const next = new Set(existing);
            let changed = false;
            for (const group of chain) {
                if (next.delete(group.id)) {
                    changed = true;
                }
            }
            return changed ? next : existing;
        });
        const timer = window.setTimeout(() => {
            document.getElementById(`wiki-article-${articleId}`)?.scrollIntoView({ block: "nearest" });
        }, 50);
        return () => window.clearTimeout(timer);
    }, [prefsReady, loaded, articleId]);

    useEffect(() => {
        if (!prefsReady || !loaded || browseGroupId === null) {
            return;
        }
        const chain = groupChain(browseGroupId, groups);
        if (chain.length === 0) {
            return;
        }
        setClosed((existing) => {
            const next = new Set(existing);
            let changed = false;
            for (const group of chain) {
                if (next.delete(group.id)) {
                    changed = true;
                }
            }
            return changed ? next : existing;
        });
        const timer = window.setTimeout(() => {
            document.getElementById(`wiki-group-${browseGroupId}`)?.scrollIntoView({ block: "nearest" });
        }, 50);
        return () => window.clearTimeout(timer);
    }, [prefsReady, loaded, browseGroupId]);

    const filtering = query.trim() !== "" || tag !== "";
    const filterSignature = `${query}|${tag}|${articles.map((item) => item.id).join(",")}`;

    useEffect(() => {
        if (!filtering || !loaded || filterExpanded.current === filterSignature) {
            return;
        }
        filterExpanded.current = filterSignature;
        setClosed((existing) => {
            const next = new Set(existing);
            let changed = false;
            for (const group of groups) {
                if (branchHasArticles(group, groups, articles) && next.delete(group.id)) {
                    changed = true;
                }
            }
            return changed ? next : existing;
        });
    }, [filtering, loaded, filterSignature, groups, articles]);

    function replaceFilter(nextQuery: string, nextTag: string) {
        const next = new URLSearchParams(searchParams.toString());
        if (nextQuery) {
            next.set("q", nextQuery);
        } else {
            next.delete("q");
        }
        if (nextTag) {
            next.set("tag", nextTag);
        } else {
            next.delete("tag");
        }
        const value = next.toString();
        router.replace(value ? `${pathname}?${value}` : pathname, { scroll: false });
    }

    function selectTag(next: string) {
        replaceFilter(query, next.toLowerCase() === tag.toLowerCase() ? "" : next);
    }

    async function toggleFavorite(item: WikiArticleSummary) {
        const next = !favorites.some((entry) => entry.id === item.id);
        const previous = favorites;
        setFavoriteBusy(item.id);
        setError(null);
        setFavorites(next ? [item, ...previous.filter((entry) => entry.id !== item.id)] : previous.filter((entry) => entry.id !== item.id));
        try {
            const response = await fetch(`/api/wiki/articles/${item.id}/favorite`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ favorite: next }),
            });
            const json = (await response.json()) as ApiResponse<{ favorite: boolean }>;
            if (!json.success || json.data.favorite !== next) {
                setFavorites(previous);
                setError(json.success ? "Не удалось изменить избранное" : json.error.message);
                return;
            }
        } catch {
            setFavorites(previous);
            setError("Не удалось изменить избранное");
        } finally {
            setFavoriteBusy(null);
        }
    }

    async function load(search: string, selectedTag: string) {
        setError(null);
        try {
            const response = await fetch(`/api/wiki?q=${encodeURIComponent(search)}&tag=${encodeURIComponent(selectedTag)}`);
            const json = (await response.json()) as ApiResponse<{ groups: WikiGroup[]; articles: WikiArticleSummary[]; tags: string[]; favorites: WikiArticleSummary[] }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setGroups(json.data.groups);
            setArticles(json.data.articles);
            setFavorites(json.data.favorites);
            setTags(json.data.tags);
        } catch {
            setError("Не удалось загрузить базу знаний");
        } finally {
            setLoaded(true);
        }
    }

    async function saveOrder(body: WikiOrderPayload): Promise<string | null> {
        try {
            const response = await fetch("/api/wiki/order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = (await response.json()) as ApiResponse<{ saved: boolean }>;
            if (!json.success) {
                return json.error.message;
            }
            await load(urlQuery, tag);
            notifySuccess("Порядок сохранён");
            return null;
        } catch {
            return "Не удалось сохранить порядок";
        }
    }

    async function openArticle(id: number) {
        const response = await fetch(`/api/wiki/articles/${id}`);
        const json = (await response.json()) as ApiResponse<WikiArticle>;
        if (!json.success) {
            setError(json.error.message);
            setArticle(null);
            setArticleReady(true);
            return;
        }
        setArticle(json.data);
        setArticleReady(true);
    }

    async function applyConfirm() {
        if (!showing || confirm === null) {
            return;
        }
        setPending(true);
        setError(null);
        try {
            if (confirm === "delete") {
                const response = await fetch(`/api/wiki/articles/${showing.id}`, { method: "DELETE" });
                const json = (await response.json()) as ApiResponse<{ id: number }>;
                if (!json.success) {
                    setError(json.error.message);
                    return;
                }
                setArticles((current) => current.filter((item) => item.id !== showing.id));
                setArticle(null);
                notifySuccess("Статья удалена");
                setConfirm(null);
                router.push("/wiki");
                return;
            }
            const archived = confirm === "archive";
            const response = await fetch(`/api/wiki/articles/${showing.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ archived }),
            });
            const json = (await response.json()) as ApiResponse<WikiArticle>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setArticle(json.data);
            setArticles((current) => current.map((item) => item.id === json.data.id ? { ...item, status: json.data.status, archived: json.data.archived } : item));
            notifySuccess(archived ? "Статья помещена в архив" : "Статья возвращена из архива");
            setConfirm(null);
        } catch {
            setError(confirm === "delete" ? "Не удалось удалить статью" : "Не удалось изменить архив статьи");
        } finally {
            setPending(false);
        }
    }

    function toggleGroup(id: number) {
        setClosed((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function collapseAll() {
        setClosed(new Set(groups.map((group) => group.id)));
    }

    function expandAll() {
        setClosed(new Set());
    }

    function openGroupDialog(parentId: number | null) {
        setGroupParent(parentId);
        setGroupOpen(true);
    }

    const roots = groups.filter((group) => group.parentId === null && (!filtering || branchHasArticles(group, groups, articles)));
    const favoriteIds = new Set(favorites.map((item) => item.id));
    function deskHref(groupId: number | null, article: number | null) {
        const next = new URLSearchParams(searchParams.toString());
        next.delete("group");
        if (groupId !== null) {
            next.set("group", String(groupId));
        }
        const value = next.toString();
        if (article !== null) {
            return value ? `/wiki/${article}?${value}` : `/wiki/${article}`;
        }
        return value ? `/wiki?${value}` : "/wiki";
    }
    const homeHref = deskHref(null, null);
    const groupHref = (id: number) => deskHref(id, null);
    const articleHref = (id: number) => deskHref(null, id);
    const treeStyle = { "--wiki-tree": `${treeWidth}px` } as CSSProperties;

    return (
        <div className="flex flex-col lg:h-[calc(100dvh-4rem)] lg:flex-row lg:overflow-hidden" style={treeStyle}>
            {mobileOpen ? (
                <button
                    type="button"
                    className="fixed inset-0 z-40 bg-black/20 lg:hidden"
                    aria-label="Закрыть список статей"
                    onClick={() => setMobileOpen(false)}
                />
            ) : null}
            <aside
                role={mobileOpen ? "dialog" : "complementary"}
                aria-modal={mobileOpen ? true : undefined}
                aria-label="Статьи"
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-[min(20rem,calc(100vw-2.5rem))] min-h-0 flex-col gap-2 overflow-y-auto border-r bg-background p-2.5 shadow-lg",
                    mobileOpen ? "flex" : "hidden",
                    "lg:static lg:z-auto lg:flex lg:w-(--wiki-tree) lg:shrink-0 lg:border-b-0 lg:shadow-none",
                    treeCollapsed && "lg:hidden",
                )}
            >
                <div className="flex items-center justify-between lg:hidden">
                    <p className="text-sm font-medium">Статьи</p>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Закрыть список" onClick={() => setMobileOpen(false)}>
                        <X />
                    </Button>
                </div>
                <button
                    type="button"
                    className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2.5 text-left text-sm text-muted-foreground hover:bg-muted"
                    onClick={() => setSearchOpen(true)}
                >
                    <Search className="size-4 shrink-0" />
                    <span className="truncate">Найти в статьях</span>
                </button>
                <WikiSearchDialog
                    open={searchOpen}
                    tags={tags}
                    onOpenChange={setSearchOpen}
                    onOpenArticle={(id) => {
                        setSearchOpen(false);
                        setMobileOpen(false);
                        router.push(articleHref(id));
                    }}
                    onOpenGroup={(id) => {
                        setSearchOpen(false);
                        setMobileOpen(false);
                        router.push(groupHref(id));
                    }}
                />
                <div className="flex items-center gap-1">
                    {canWrite ? (
                        <div className="@container/wiki-actions flex min-w-0 flex-1 gap-1">
                            <Link
                                href="/wiki/new"
                                aria-label="Новая статья"
                                className={cn(
                                    buttonVariants({ size: "sm", variant: "outline" }),
                                    "size-8 shrink-0 px-0 @[11rem]/wiki-actions:h-8 @[11rem]/wiki-actions:w-auto @[11rem]/wiki-actions:flex-1 @[11rem]/wiki-actions:px-2.5",
                                )}
                            >
                                <FilePlus />
                                <span className="hidden @[11rem]/wiki-actions:inline">Статья</span>
                            </Link>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                aria-label="Новая группа"
                                className="size-8 shrink-0 px-0 @[11rem]/wiki-actions:h-8 @[11rem]/wiki-actions:w-auto @[11rem]/wiki-actions:flex-1 @[11rem]/wiki-actions:px-2.5"
                                onClick={() => openGroupDialog(null)}
                            >
                                <FolderPlus />
                                <span className="hidden @[11rem]/wiki-actions:inline">Группа</span>
                            </Button>
                        </div>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1">
                        <TreeAction label="Свернуть всё" disabled={groups.length === 0} onClick={collapseAll}>
                            <ChevronsDownUp />
                        </TreeAction>
                        {canWrite ? (
                            <TreeAction
                                label="Порядок"
                                disabled={!loaded || filtering || (groups.length === 0 && articles.length === 0)}
                                onClick={() => setSorting(true)}
                            >
                                <ArrowUpDown />
                            </TreeAction>
                        ) : (
                            <TreeAction label="Развернуть всё" disabled={groups.length === 0} onClick={expandAll}>
                                <ChevronsUpDown />
                            </TreeAction>
                        )}
                        <TreeAction label="Скрыть список" className="hidden lg:inline-flex" onClick={() => setTreeCollapsed(true)}>
                            <PanelLeftClose />
                        </TreeAction>
                    </div>
                </div>
                {!loaded ? <StackSkeleton rows={6} /> : null}
                {loaded && favorites.length > 0 ? (
                    <div className="flex flex-col text-sm">
                        <button
                            type="button"
                            className="flex min-w-0 items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-muted"
                            aria-expanded={!favoritesClosed}
                            onClick={() => setFavoritesClosed((value) => !value)}
                        >
                            <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !favoritesClosed && "rotate-90")} />
                            <Star className="size-4 shrink-0 fill-current text-amber-600" aria-hidden />
                            <span className="truncate">Избранное</span>
                        </button>
                        {favoritesClosed ? null : (
                            <ul className="ml-3 flex flex-col border-l pl-1">
                                {favorites.map((item) => (
                                    <li key={item.id} className="flex items-center">
                                        <Link
                                            href={articleHref(item.id)}
                                            onClick={() => setMobileOpen(false)}
                                            className={cn(
                                                "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted",
                                                item.id === articleId && "bg-muted font-medium",
                                            )}
                                        >
                                            <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                            <span className="truncate">{articleLabel(item)}</span>
                                        </Link>
                                        <FavoriteButton
                                            active
                                            pending={favoriteBusy === item.id}
                                            size="icon-xs"
                                            onClick={() => void toggleFavorite(item)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                ) : null}
                {loaded && articles.length === 0 && groups.length === 0 && favorites.length === 0 && !filtering ? <p className="text-sm text-muted-foreground">Статей пока нет.</p> : null}
                {loaded && filtering && articles.length === 0 ? <p className="text-sm text-muted-foreground">Ничего не найдено.</p> : null}
                <ul className="flex flex-col gap-0.5 text-sm">
                    {roots.map((group) => (
                        <GroupBranch
                            key={group.id}
                            group={group}
                            groups={groups}
                            articles={articles}
                            activeId={articleId}
                            activeGroupId={browseGroupId}
                            closed={closed}
                            filtering={filtering}
                            canWrite={canWrite}
                            hrefFor={articleHref}
                            onToggle={toggleGroup}
                            onCreate={openGroupDialog}
                            onCollapseAll={collapseAll}
                            onExpandAll={expandAll}
                            onNavigate={() => setMobileOpen(false)}
                            favoriteIds={favoriteIds}
                            favoriteBusy={favoriteBusy}
                            onFavorite={(item) => void toggleFavorite(item)}
                        />
                    ))}
                </ul>
            </aside>
            {treeCollapsed ? (
                <div className="hidden w-10 shrink-0 flex-col items-center border-r py-2 lg:flex">
                    <TreeAction label="Показать список" onClick={() => setTreeCollapsed(false)}>
                        <PanelLeftOpen />
                    </TreeAction>
                </div>
            ) : null}
            <TreeResize
                width={treeCollapsed ? 0 : treeWidth}
                onWidth={setTreeWidth}
                onCollapsed={setTreeCollapsed}
            />
            <div ref={articleScrollRef} className="flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-y-auto">
                <div className="sticky top-0 z-20 flex items-center gap-1 border-b bg-background/95 px-2 py-1.5 backdrop-blur lg:hidden">
                    <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => setMobileOpen(true)}>
                        <PanelLeftOpen />
                        Статьи
                    </Button>
                    <div className="ml-auto flex items-center">
                        {showing && showing.headings.length > 0 ? (
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Содержание" onClick={() => setTocOpen(true)}>
                                <List />
                            </Button>
                        ) : null}
                        {showing ? (
                            <FavoriteButton
                                active={favoriteIds.has(showing.id)}
                                pending={favoriteBusy === showing.id}
                                onClick={() => void toggleFavorite(showing)}
                            />
                        ) : null}
                        {canWrite && showing ? (
                            <ArticleActions
                                draft={showing.status === "draft"}
                                archived={showing.archived}
                                pending={pending}
                                onPublish={() => router.push(`/wiki/${showing.id}/edit?publish=1`)}
                                onEdit={() => router.push(`/wiki/${showing.id}/edit`)}
                                onArchive={() => setConfirm(showing.archived ? "restore" : "archive")}
                                onDelete={() => setConfirm("delete")}
                            />
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-col gap-3 p-3 lg:p-4">
                <FormAlert message={error} />
                {showing ? (
                    <article className="flex flex-col gap-3 lg:gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-col gap-2">
                                {crumbTitle && crumbGroupId !== null ? (
                                    <ArticlePath
                                        title={crumbTitle}
                                        groups={groupChain(crumbGroupId, groups)}
                                        listHref={homeHref}
                                        groupHref={groupHref}
                                        onNavigate={() => setMobileOpen(false)}
                                    />
                                ) : null}
                                <h2 className="text-lg font-semibold">{showing.title}</h2>
                                <ArticleStatus article={showing} />
                                {showing.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {showing.tags.map((item) => (
                                            <button
                                                key={item}
                                                type="button"
                                                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                                                onClick={() => selectTag(item)}
                                            >
                                                {item}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        {showing.status === "draft" ? (
                            <p role="note" className="flex w-full items-start gap-2 rounded-md border border-sky-600/40 bg-sky-500/15 px-3 py-2 text-sm font-medium text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-50">
                                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                                Статья не опубликована. Пользователи не увидят её, пока она не будет опубликована.
                            </p>
                        ) : null}
                        {showing.archived ? (
                            <p role="note" className="flex w-full items-start gap-2 rounded-md border border-amber-600/50 bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-50">
                                <Archive className="mt-0.5 size-4 shrink-0" aria-hidden />
                                Статья находится в архиве. Информация может быть неактуальной.
                            </p>
                        ) : null}
                        <ArticleBrief text={showing.summary ?? ""} />
                        <NewsEditor
                            content={showing.document}
                            loadKey={`${showing.id}:${showing.updatedAt}`}
                            editable={false}
                            assetsUrl="/api/wiki/assets"
                            anchorLinks
                            anchorPage={`/wiki/${showing.id}`}
                        />
                    </article>
                ) : browseGroup ? (
                    <GroupBrowse
                        group={browseGroup}
                        groups={groups}
                        articles={articles}
                        homeHref={homeHref}
                        groupHref={groupHref}
                        articleHref={articleHref}
                        onNavigate={() => setMobileOpen(false)}
                    />
                ) : (articleId !== null && !articleReady) || (browseGroupId !== null && !loaded) ? (
                    <StackSkeleton rows={6} />
                ) : loaded && browseGroupId !== null ? (
                    <p className="text-sm text-muted-foreground">Группа не найдена.</p>
                ) : loaded ? (
                    <p className="text-sm text-muted-foreground">Выберите статью в списке или найдите её по тексту и тегам.</p>
                ) : null}
                </div>
                <ScrollTop targetRef={articleScrollRef} />
            </div>
            <aside className="hidden flex-col gap-2 border-t p-3 lg:flex lg:min-h-0 lg:w-60 lg:shrink-0 lg:gap-3 lg:overflow-y-auto lg:border-t-0 lg:border-l">
                {showing ? (
                    <div className="flex flex-col gap-0.5">
                        <FavoriteButton
                            labelled
                            active={favoriteIds.has(showing.id)}
                            pending={favoriteBusy === showing.id}
                            onClick={() => void toggleFavorite(showing)}
                        />
                        {canWrite ? (
                            <ArticleActions
                                labelled
                                draft={showing.status === "draft"}
                                archived={showing.archived}
                                pending={pending}
                                onPublish={() => router.push(`/wiki/${showing.id}/edit?publish=1`)}
                                onEdit={() => router.push(`/wiki/${showing.id}/edit`)}
                                onArchive={() => setConfirm(showing.archived ? "restore" : "archive")}
                                onDelete={() => setConfirm("delete")}
                            />
                        ) : null}
                    </div>
                ) : null}
                <p className="text-xs font-medium text-muted-foreground">Содержание</p>
                {articleId !== null && !articleReady ? <StackSkeleton rows={4} /> : null}
                {showing && showing.headings.length > 0 ? <WikiToc articleId={showing.id} headings={showing.headings} /> : null}
                {showing && showing.headings.length === 0 ? <p className="text-sm text-muted-foreground">Разделов пока нет.</p> : null}
                {articleId === null && loaded ? <p className="text-sm text-muted-foreground">Содержание появится у выбранной статьи.</p> : null}
            </aside>
            {showing && showing.headings.length > 0 ? (
                <Sheet open={tocOpen} onOpenChange={setTocOpen}>
                    <SheetContent side="bottom" className="max-h-[70dvh] gap-2 lg:hidden">
                        <SheetHeader className="pr-10">
                            <SheetTitle>Содержание</SheetTitle>
                        </SheetHeader>
                        <div className="overflow-y-auto px-2 pb-4">
                            <WikiToc articleId={showing.id} headings={showing.headings} onNavigate={() => setTocOpen(false)} />
                        </div>
                    </SheetContent>
                </Sheet>
            ) : null}
            {canWrite && showing && confirm ? (
                <ConfirmDialog
                    open
                    title={confirmTitle(confirm)}
                    description={confirmText(confirm, showing.title)}
                    confirmLabel={confirmLabel(confirm)}
                    confirmVariant={confirm === "restore" ? "default" : "destructive"}
                    isPending={pending}
                    onConfirm={applyConfirm}
                    onOpenChange={(open) => {
                        if (!open) {
                            setConfirm(null);
                        }
                    }}
                />
            ) : null}
            {canWrite ? (
                <GroupDialog
                    open={groupOpen}
                    parentId={groupParent}
                    groups={groups}
                    onOpenChange={setGroupOpen}
                    onCreated={() => void load(urlQuery, tag)}
                />
            ) : null}
            {canWrite ? (
                <SortDialog
                    key={sorting ? "open" : "closed"}
                    open={sorting}
                    groups={groups}
                    articles={articles}
                    onOpenChange={setSorting}
                    onSave={saveOrder}
                />
            ) : null}
        </div>
    );
}

function TreeAction({
    label,
    className,
    disabled,
    variant = "ghost",
    onClick,
    children,
}: {
    label: string;
    className?: string;
    disabled?: boolean;
    variant?: "ghost" | "destructive";
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={
                    <Button type="button" variant={variant} size="icon-sm" className={className} aria-label={label} disabled={disabled} onClick={onClick}>
                        {children}
                    </Button>
                }
            />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function TreeResize({
    width,
    onWidth,
    onCollapsed,
}: {
    width: number;
    onWidth: (width: number) => void;
    onCollapsed: (collapsed: boolean) => void;
}) {
    const widthRef = useRef(width);
    widthRef.current = width;

    function apply(next: number) {
        if (next < 120) {
            onCollapsed(true);
            return;
        }
        onCollapsed(false);
        onWidth(clampWidth(next));
    }

    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = widthRef.current;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        function move(ev: globalThis.PointerEvent) {
            apply(startWidth + ev.clientX - startX);
        }
        function end() {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
        }
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
    }

    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            if (widthRef.current <= TREE_MIN) {
                onCollapsed(true);
                return;
            }
            apply(widthRef.current - 24);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            apply(Math.max(widthRef.current, TREE_MIN) + 24);
        } else if (event.key === "Home") {
            event.preventDefault();
            onCollapsed(true);
        } else if (event.key === "End") {
            event.preventDefault();
            onCollapsed(false);
            onWidth(TREE_MAX);
        }
    }

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Ширина списка статей"
            aria-valuemin={0}
            aria-valuemax={TREE_MAX}
            aria-valuenow={width}
            tabIndex={0}
            className="group/resize relative hidden w-1.5 shrink-0 cursor-col-resize touch-none outline-none focus-visible:bg-ring/40 lg:block"
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            onDoubleClick={() => {
                onCollapsed(false);
                onWidth(TREE_DEFAULT);
            }}
        >
            <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-hover/resize:w-0.5 group-hover/resize:bg-foreground/30" />
        </div>
    );
}

function ArticlePath({
    title,
    groups,
    listHref,
    groupHref,
    onNavigate,
}: {
    title: string;
    groups: WikiGroup[];
    listHref: string;
    groupHref: (id: number) => string;
    onNavigate: () => void;
}) {
    return (
        <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap gap-1 overflow-hidden text-xs sm:gap-1.5">
                <BreadcrumbItem className="shrink-0">
                    <BreadcrumbLink render={<Link href={listHref} aria-label="База знаний" title="База знаний" onClick={onNavigate} />}>
                        <House className="size-3.5" aria-hidden />
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {groups.map((group) => (
                    <Fragment key={group.id}>
                        <BreadcrumbSeparator className="shrink-0" />
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbLink
                                className="max-w-40 truncate"
                                render={<Link href={groupHref(group.id)} onClick={onNavigate} />}
                            >
                                {group.title}
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </Fragment>
                ))}
                <BreadcrumbSeparator className="shrink-0" />
                <BreadcrumbItem className="min-w-0">
                    <BreadcrumbPage className="truncate">{title}</BreadcrumbPage>
                </BreadcrumbItem>
            </BreadcrumbList>
        </Breadcrumb>
    );
}

function articleLabel(item: WikiArticleSummary): string {
    return `${item.title}${item.status === "draft" ? " · Черновик" : ""}${item.archived ? " · Архив" : ""}`;
}

function FavoriteButton({
    active,
    pending,
    onClick,
    className,
    size = "icon-sm",
    labelled = false,
}: {
    active: boolean;
    pending: boolean;
    onClick: () => void;
    className?: string;
    size?: "icon-sm" | "icon-xs";
    labelled?: boolean;
}) {
    const label = active ? "Убрать из избранного" : "В избранное";
    return (
        <Button
            type="button"
            variant="ghost"
            size={labelled ? "sm" : size}
            className={cn(labelled ? "w-full justify-start" : "shrink-0", active && "text-amber-600", className)}
            aria-pressed={active}
            aria-label={label}
            disabled={pending}
            onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClick();
            }}
        >
            {pending ? <ButtonSpinner /> : <Star className={cn(active && "fill-current")} />}
            {labelled ? <span className="truncate">{label}</span> : null}
        </Button>
    );
}

interface SortDrag {
    kind: "group" | "article";
    id: number;
    parentId: number | null;
}

interface DropSlot {
    place: "before" | "after" | "inside";
    kind: "group" | "article";
    id: number;
    edge: "start" | "end";
}

function SortDialog({
    open,
    groups,
    articles,
    onOpenChange,
    onSave,
}: {
    open: boolean;
    groups: WikiGroup[];
    articles: WikiArticleSummary[];
    onOpenChange: (open: boolean) => void;
    onSave: (body: WikiOrderPayload) => Promise<string | null>;
}) {
    const [draftGroups, setDraftGroups] = useState(groups);
    const [draftArticles, setDraftArticles] = useState(articles);
    const [closed, setClosed] = useState<Set<number>>(new Set());
    const [hideDrafts, setHideDrafts] = useState(false);
    const [hideArchived, setHideArchived] = useState(false);
    const [drag, setDrag] = useState<SortDrag | null>(null);
    const [over, setOver] = useState<DropSlot | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dragRef = useRef<SortDrag | null>(null);
    const overRef = useRef<DropSlot | null>(null);
    const groupsRef = useRef(draftGroups);
    groupsRef.current = draftGroups;
    const dirty = orderFingerprint(draftGroups, draftArticles) !== orderFingerprint(groups, articles);
    const roots = draftGroups.filter((group) => group.parentId === null);

    function beginDrag(event: DragEvent<HTMLDivElement>, next: SortDrag) {
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", `${next.kind}:${next.id}`);
        dragRef.current = next;
        setDrag(next);
    }

    function finishDrag() {
        dragRef.current = null;
        overRef.current = null;
        setDrag(null);
        setOver(null);
    }

    function showSlot(slot: DropSlot | null) {
        const nextKey = slot ? slotKey(slot) : "";
        const currentKey = overRef.current ? slotKey(overRef.current) : "";
        if (nextKey === currentKey) {
            return;
        }
        overRef.current = slot;
        setOver(slot);
    }

    function allowDrop(event: DragEvent<HTMLDivElement>, kind: SortDrag["kind"], id: number) {
        event.stopPropagation();
        const current = dragRef.current;
        if (!current) {
            return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = rect.height === 0 ? 0.5 : (event.clientY - rect.top) / rect.height;
        const slot = resolveSlot(current, kind, id, ratio, groupsRef.current);
        if (!slot) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        showSlot(slot);
    }

    function dropOn(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        event.stopPropagation();
        const current = dragRef.current;
        const slot = overRef.current;
        finishDrag();
        if (!current || !slot) {
            return;
        }
        if (slot.place === "inside" && slot.kind === "group") {
            setClosed((ids) => ids.has(slot.id) ? new Set([...ids].filter((id) => id !== slot.id)) : ids);
        }
        if (current.kind === "article") {
            setDraftArticles((items) => placeArticle(items, current.id, slot));
            return;
        }
        setDraftGroups((items) => placeGroup(items, current.id, slot));
    }

    function toggleClosed(id: number) {
        setClosed((ids) => {
            const next = new Set(ids);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function moveRow(kind: SortDrag["kind"], id: number, direction: -1 | 1) {
        if (kind === "group") {
            setDraftGroups((items) => moveAmong(items, id, direction, (item, current) => item.parentId === current.parentId, () => true));
            return;
        }
        setDraftArticles((items) => moveAmong(
            items,
            id,
            direction,
            (item, current) => item.groupId === current.groupId,
            (item) => articleShown(item, hideDrafts, hideArchived),
        ));
    }

    function raiseRow(kind: SortDrag["kind"], id: number) {
        if (kind === "group") {
            setDraftGroups((items) => promoteGroup(items, id));
            return;
        }
        setDraftArticles((items) => promoteArticle(items, id, groupsRef.current));
    }

    async function save() {
        setSaving(true);
        setError(null);
        const message = await onSave({
            groups: ordersBy(draftGroups, (group) => group.parentId, (group) => group.id),
            articles: ordersBy(draftArticles, (item) => item.groupId, (item) => item.id).flatMap((item) => (
                item.parentId === null ? [] : [{ groupId: item.parentId, ids: item.ids }]
            )),
        });
        setSaving(false);
        if (message) {
            setError(message);
            return;
        }
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (!next && saving) {
                return;
            }
            onOpenChange(next);
        }}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Порядок</DialogTitle>
                    <DialogDescription>Линия показывает, куда встанет строка. Статью можно перенести в другую группу, а группу — вложить в другую. Скрытые черновики и архивные статьи остаются на своих местах.</DialogDescription>
                </DialogHeader>
                <FormAlert message={error} />
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <Label className="font-normal">
                        <Checkbox checked={hideDrafts} onCheckedChange={(value) => setHideDrafts(value === true)} />
                        Скрыть черновики
                    </Label>
                    <Label className="font-normal">
                        <Checkbox checked={hideArchived} onCheckedChange={(value) => setHideArchived(value === true)} />
                        Скрыть архив
                    </Label>
                </div>
                <div className="max-h-[min(32rem,calc(100dvh-16rem))] min-w-0 overflow-y-auto pr-1">
                    {roots.length === 0 ? <p className="text-sm text-muted-foreground">Статей пока нет.</p> : (
                        <ul className="flex flex-col gap-1">
                            {roots.map((group) => (
                                <SortBranch
                                    key={group.id}
                                    group={group}
                                    groups={draftGroups}
                                    articles={draftArticles}
                                    closed={closed}
                                    drag={drag}
                                    over={over}
                                    articleShown={(item) => articleShown(item, hideDrafts, hideArchived)}
                                    onToggle={toggleClosed}
                                    onMove={moveRow}
                                    onRaise={raiseRow}
                                    onDragStart={beginDrag}
                                    onDragEnd={finishDrag}
                                    onDragOver={allowDrop}
                                    onDrop={dropOn}
                                />
                            ))}
                        </ul>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
                        Отмена
                    </Button>
                    <Button type="button" disabled={!dirty || saving} onClick={() => void save()}>
                        {saving ? <ButtonSpinner /> : null}
                        Сохранить
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SortBranch({
    group,
    groups,
    articles,
    closed,
    drag,
    over,
    articleShown,
    onToggle,
    onMove,
    onRaise,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
}: {
    group: WikiGroup;
    groups: WikiGroup[];
    articles: WikiArticleSummary[];
    closed: Set<number>;
    drag: SortDrag | null;
    over: DropSlot | null;
    articleShown: (item: WikiArticleSummary) => boolean;
    onToggle: (id: number) => void;
    onMove: (kind: SortDrag["kind"], id: number, direction: -1 | 1) => void;
    onRaise: (kind: SortDrag["kind"], id: number) => void;
    onDragStart: (event: DragEvent<HTMLDivElement>, drag: SortDrag) => void;
    onDragEnd: () => void;
    onDragOver: (event: DragEvent<HTMLDivElement>, kind: SortDrag["kind"], id: number) => void;
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
    const children = groups.filter((item) => item.parentId === group.id);
    const own = articles.filter((item) => item.groupId === group.id && articleShown(item));
    const siblings = groups.filter((item) => item.parentId === group.parentId);
    const groupIndex = siblings.findIndex((item) => item.id === group.id);
    const before = over?.place === "before" && over.kind === "group" && over.id === group.id;
    const after = over?.place === "after" && over.kind === "group" && over.id === group.id;
    const inside = over?.place === "inside" && over.kind === "group" && over.id === group.id;
    const articleStart = inside && drag?.kind === "article" && over?.edge === "start";
    const articleEnd = inside && drag?.kind === "article" && over?.edge === "end";
    const groupEnd = inside && drag?.kind === "group";
    const nested = own.length > 0 || children.length > 0;
    const open = nested && (!closed.has(group.id) || inside);
    return (
        <li className="relative flex flex-col gap-1">
            {before ? <DropLine className="top-0 -translate-y-1/2" /> : null}
            <SortRow
                label={group.title}
                icon={open ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
                leading={nested ? <SortFold title={group.title} open={open} onClick={() => onToggle(group.id)} /> : undefined}
                trailing={(
                    <SortMoves
                        canUp={groupIndex > 0}
                        canDown={groupIndex >= 0 && groupIndex < siblings.length - 1}
                        canRaise={group.parentId !== null}
                        onUp={() => onMove("group", group.id, -1)}
                        onDown={() => onMove("group", group.id, 1)}
                        onRaise={() => onRaise("group", group.id)}
                    />
                )}
                dragging={drag?.kind === "group" && drag.id === group.id}
                inside={inside}
                onDragStart={(event) => onDragStart(event, { kind: "group", id: group.id, parentId: group.parentId })}
                onDragEnd={onDragEnd}
                onDragOver={(event) => onDragOver(event, "group", group.id)}
                onDrop={onDrop}
            />
            {open ? (
                <ul className="ml-5 flex flex-col gap-1 border-l pl-2">
                    {articleStart ? <li className="relative h-2"><DropLine className="top-0" /></li> : null}
                    {own.map((item, index) => (
                        <li key={item.id}>
                            <SortRow
                                label={articleLabel(item)}
                                icon={<FileText className="size-3.5 shrink-0 text-muted-foreground" />}
                                trailing={(
                                    <SortMoves
                                        canUp={index > 0}
                                        canDown={index < own.length - 1}
                                        canRaise={group.parentId !== null}
                                        onUp={() => onMove("article", item.id, -1)}
                                        onDown={() => onMove("article", item.id, 1)}
                                        onRaise={() => onRaise("article", item.id)}
                                    />
                                )}
                                dragging={drag?.kind === "article" && drag.id === item.id}
                                before={over?.place === "before" && over.kind === "article" && over.id === item.id}
                                after={over?.place === "after" && over.kind === "article" && over.id === item.id}
                                onDragStart={(event) => onDragStart(event, { kind: "article", id: item.id, parentId: group.id })}
                                onDragEnd={onDragEnd}
                                onDragOver={(event) => onDragOver(event, "article", item.id)}
                                onDrop={onDrop}
                            />
                        </li>
                    ))}
                    {articleEnd ? <li className="relative h-2"><DropLine className="top-0" /></li> : null}
                    {children.map((child) => (
                        <SortBranch
                            key={child.id}
                            group={child}
                            groups={groups}
                            articles={articles}
                            closed={closed}
                            drag={drag}
                            over={over}
                            articleShown={articleShown}
                            onToggle={onToggle}
                            onMove={onMove}
                            onRaise={onRaise}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onDragOver={onDragOver}
                            onDrop={onDrop}
                        />
                    ))}
                    {groupEnd ? <li className="relative h-2"><DropLine className="top-0" /></li> : null}
                </ul>
            ) : null}
            {after ? <DropLine className="bottom-0 translate-y-1/2" /> : null}
        </li>
    );
}

function SortFold({ title, open, onClick }: { title: string; open: boolean; onClick: () => void }) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={open ? `Свернуть «${title}»` : `Развернуть «${title}»`}
            aria-expanded={open}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
        </Button>
    );
}

function SortMoves({
    canUp,
    canDown,
    canRaise,
    onUp,
    onDown,
    onRaise,
}: {
    canUp: boolean;
    canDown: boolean;
    canRaise: boolean;
    onUp: () => void;
    onDown: () => void;
    onRaise: () => void;
}) {
    return (
        <div className="flex shrink-0">
            <SortMove label="Выше" disabled={!canUp} onClick={onUp}><ArrowUp /></SortMove>
            <SortMove label="Ниже" disabled={!canDown} onClick={onDown}><ArrowDown /></SortMove>
            <SortMove label="На уровень выше" disabled={!canRaise} onClick={onRaise}><CornerUpLeft /></SortMove>
        </div>
    );
}

function SortMove({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                render={(
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={label}
                        disabled={disabled}
                        onClick={(event) => {
                            event.stopPropagation();
                            onClick();
                        }}
                    >
                        {children}
                    </Button>
                )}
            />
            <TooltipContent>{label}</TooltipContent>
        </Tooltip>
    );
}

function SortRow({
    label,
    icon,
    leading,
    trailing,
    dragging,
    inside = false,
    before = false,
    after = false,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDrop,
}: {
    label: string;
    icon: ReactNode;
    leading?: ReactNode;
    trailing?: ReactNode;
    dragging: boolean;
    inside?: boolean;
    before?: boolean;
    after?: boolean;
    onDragStart: (event: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
    return (
        <div
            className={cn(
                "relative flex items-center gap-0.5 rounded-md",
                dragging && "opacity-50",
                inside && "bg-primary/10 ring-1 ring-primary",
            )}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            {before ? <DropLine className="top-0 -translate-y-1/2" /> : null}
            {leading ?? <span className="size-6 shrink-0" aria-hidden />}
            <div
                role="button"
                tabIndex={0}
                draggable
                aria-label={`Переместить «${label}»`}
                className="flex min-w-0 flex-1 cursor-grab items-center gap-2 px-1 py-1.5 active:cursor-grabbing"
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
            >
                <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                {icon}
                <span className="min-w-0 truncate">{label}</span>
            </div>
            {trailing}
            {after ? <DropLine className="bottom-0 translate-y-1/2" /> : null}
        </div>
    );
}

function DropLine({ className }: { className?: string }) {
    return <div className={cn("pointer-events-none absolute inset-x-2 z-10 h-1.5 rounded-full bg-primary", className)} aria-hidden />;
}

function ordersBy<T>(items: T[], parentOf: (item: T) => number | null, idOf: (item: T) => number): { parentId: number | null; ids: number[] }[] {
    const map = new Map<string, { parentId: number | null; ids: number[] }>();
    for (const item of items) {
        const parentId = parentOf(item);
        const key = parentId === null ? "root" : String(parentId);
        const list = map.get(key) ?? { parentId, ids: [] };
        list.ids.push(idOf(item));
        map.set(key, list);
    }
    return [...map.values()];
}

function orderFingerprint(groups: WikiGroup[], articles: WikiArticleSummary[]): string {
    const groupPart = ordersBy(groups, (group) => group.parentId, (group) => group.id)
        .map((item) => `${item.parentId ?? "root"}:${item.ids.join(",")}`)
        .sort()
        .join(";");
    const articlePart = ordersBy(articles, (item) => item.groupId, (item) => item.id)
        .map((item) => `${item.parentId ?? ""}:${item.ids.join(",")}`)
        .sort()
        .join(";");
    return `${groupPart}#${articlePart}`;
}

function slotKey(slot: DropSlot): string {
    return `${slot.place}:${slot.kind}:${slot.id}:${slot.edge}`;
}

function resolveSlot(drag: SortDrag, kind: "group" | "article", id: number, ratio: number, groups: WikiGroup[]): DropSlot | null {
    if (drag.kind === "article") {
        if (kind === "article") {
            if (drag.id === id) {
                return null;
            }
            return { place: ratio < 0.5 ? "before" : "after", kind: "article", id, edge: "end" };
        }
        return { place: "inside", kind: "group", id, edge: ratio < 0.5 ? "start" : "end" };
    }
    if (kind !== "group" || isDescendant(groups, drag.id, id)) {
        return null;
    }
    if (ratio < 0.3) {
        return { place: "before", kind: "group", id, edge: "start" };
    }
    if (ratio > 0.7) {
        return { place: "after", kind: "group", id, edge: "end" };
    }
    return { place: "inside", kind: "group", id, edge: "end" };
}

function isDescendant(groups: WikiGroup[], ancestorId: number, nodeId: number): boolean {
    const byId = new Map(groups.map((group) => [group.id, group]));
    let current = byId.get(nodeId) ?? null;
    const seen = new Set<number>();
    while (current && !seen.has(current.id)) {
        if (current.id === ancestorId) {
            return true;
        }
        seen.add(current.id);
        current = current.parentId === null ? null : byId.get(current.parentId) ?? null;
    }
    return false;
}

function placeArticle(items: WikiArticleSummary[], id: number, slot: DropSlot): WikiArticleSummary[] {
    if (slot.kind === "article") {
        if (slot.id === id || (slot.place !== "before" && slot.place !== "after")) {
            return items;
        }
        const target = items.find((item) => item.id === slot.id);
        if (!target) {
            return items;
        }
        const siblings = items.filter((item) => item.groupId === target.groupId && item.id !== id);
        const at = siblings.findIndex((item) => item.id === target.id);
        return reorderInto(items, id, (item) => item.groupId === target.groupId, slot.place === "before" ? at : at + 1, (item) => ({ ...item, groupId: target.groupId }));
    }
    if (slot.place !== "inside") {
        return items;
    }
    const siblings = items.filter((item) => item.groupId === slot.id && item.id !== id);
    return reorderInto(items, id, (item) => item.groupId === slot.id, slot.edge === "start" ? 0 : siblings.length, (item) => ({ ...item, groupId: slot.id }));
}

function articleShown(item: WikiArticleSummary, hideDrafts: boolean, hideArchived: boolean): boolean {
    if (hideDrafts && item.status === "draft") {
        return false;
    }
    if (hideArchived && item.archived) {
        return false;
    }
    return true;
}

function moveAmong<T extends { id: number }>(
    items: T[],
    id: number,
    direction: -1 | 1,
    sameParent: (item: T, current: T) => boolean,
    visible: (item: T) => boolean,
): T[] {
    const current = items.find((item) => item.id === id);
    if (!current) {
        return items;
    }
    const siblings = items.filter((item) => sameParent(item, current) && visible(item));
    const index = siblings.findIndex((item) => item.id === id);
    if (index < 0) {
        return items;
    }
    const target = siblings[index + direction];
    if (!target) {
        return items;
    }
    return swapById(items, id, target.id);
}

function swapById<T extends { id: number }>(items: T[], leftId: number, rightId: number): T[] {
    const left = items.findIndex((item) => item.id === leftId);
    const right = items.findIndex((item) => item.id === rightId);
    if (left < 0 || right < 0 || left === right) {
        return items;
    }
    const copy = items.slice();
    const held = copy[left];
    copy[left] = copy[right];
    copy[right] = held;
    return copy;
}

function promoteGroup(items: WikiGroup[], id: number): WikiGroup[] {
    const group = items.find((item) => item.id === id);
    if (!group || group.parentId === null) {
        return items;
    }
    return placeGroup(items, id, { place: "after", kind: "group", id: group.parentId, edge: "end" });
}

function promoteArticle(items: WikiArticleSummary[], id: number, groups: WikiGroup[]): WikiArticleSummary[] {
    const article = items.find((item) => item.id === id);
    if (!article) {
        return items;
    }
    const group = groups.find((item) => item.id === article.groupId);
    if (!group || group.parentId === null) {
        return items;
    }
    const parentId = group.parentId;
    const siblings = items.filter((item) => item.groupId === parentId && item.id !== id);
    return reorderInto(items, id, (item) => item.groupId === parentId, siblings.length, (item) => ({ ...item, groupId: parentId }));
}

function placeGroup(items: WikiGroup[], id: number, slot: DropSlot): WikiGroup[] {
    if (slot.kind !== "group" || isDescendant(items, id, slot.id)) {
        return items;
    }
    if (slot.place === "inside") {
        const siblings = items.filter((item) => item.parentId === slot.id && item.id !== id);
        return reorderInto(items, id, (item) => item.parentId === slot.id, siblings.length, (item) => ({ ...item, parentId: slot.id }));
    }
    const target = items.find((item) => item.id === slot.id);
    if (!target || (target.parentId !== null && isDescendant(items, id, target.parentId))) {
        return items;
    }
    const siblings = items.filter((item) => item.parentId === target.parentId && item.id !== id);
    const at = siblings.findIndex((item) => item.id === target.id);
    if (at < 0) {
        return items;
    }
    return reorderInto(items, id, (item) => item.parentId === target.parentId, slot.place === "before" ? at : at + 1, (item) => ({ ...item, parentId: target.parentId }));
}

function reorderInto<T extends { id: number }>(
    items: T[],
    id: number,
    belongs: (item: T) => boolean,
    index: number,
    update: (item: T) => T,
): T[] {
    const current = items.find((item) => item.id === id);
    if (!current) {
        return items;
    }
    const moved = update(current);
    const without = items.filter((item) => item.id !== id);
    const result: T[] = [];
    let seen = 0;
    let inserted = false;
    for (const item of without) {
        if (belongs(item) && seen === index) {
            result.push(moved);
            inserted = true;
        }
        if (belongs(item)) {
            seen += 1;
        }
        result.push(item);
    }
    if (!inserted) {
        result.push(moved);
    }
    return result;
}

function ArticleChoices({
    items,
    hrefFor,
    onNavigate,
    empty,
}: {
    items: WikiArticleSummary[];
    hrefFor: (id: number) => string;
    onNavigate: () => void;
    empty?: string;
}) {
    if (items.length === 0) {
        return empty ? <p className="text-sm text-muted-foreground">{empty}</p> : null;
    }
    return (
        <ul className="flex flex-col gap-0.5">
            {items.map((item) => (
                <li key={item.id}>
                    <Link href={hrefFor(item.id)} onClick={onNavigate} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                        <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{articleLabel(item)}</span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function GroupBrowse({
    group,
    groups,
    articles,
    homeHref,
    groupHref,
    articleHref,
    onNavigate,
}: {
    group: WikiGroup;
    groups: WikiGroup[];
    articles: WikiArticleSummary[];
    homeHref: string;
    groupHref: (id: number) => string;
    articleHref: (id: number) => string;
    onNavigate: () => void;
}) {
    const parents = groupChain(group.id, groups).slice(0, -1);
    const own = articles.filter((item) => item.groupId === group.id);
    const nested = groupOptions(groups, group.id);
    return (
        <div className="flex flex-col gap-6">
            <ArticlePath title={group.title} groups={parents} listHref={homeHref} groupHref={groupHref} onNavigate={onNavigate} />
            <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold">{group.title}</h2>
                <h3 className="text-sm font-medium text-muted-foreground">Статьи группы</h3>
                <ArticleChoices items={own} hrefFor={articleHref} onNavigate={onNavigate} empty="В этой группе статей нет." />
            </div>
            {nested.length > 0 ? (
                <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-medium text-muted-foreground">Вложенные группы</h3>
                    {nested.map(({ group: item, depth }) => {
                        const childArticles = articles.filter((article) => article.groupId === item.id);
                        return (
                            <div key={item.id} className="flex flex-col gap-1" style={{ paddingLeft: depth * 12 }}>
                                <Link href={groupHref(item.id)} onClick={onNavigate} className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
                                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{item.title}</span>
                                </Link>
                                {childArticles.length > 0 ? (
                                    <div className="pl-4">
                                        <ArticleChoices items={childArticles} hrefFor={articleHref} onNavigate={onNavigate} />
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

function branchHasArticles(group: WikiGroup, groups: WikiGroup[], articles: WikiArticleSummary[]): boolean {
    if (articles.some((item) => item.groupId === group.id)) {
        return true;
    }
    return groups.filter((item) => item.parentId === group.id).some((child) => branchHasArticles(child, groups, articles));
}

function groupChain(groupId: number, groups: WikiGroup[]): WikiGroup[] {
    const byId = new Map(groups.map((group) => [group.id, group]));
    const chain: WikiGroup[] = [];
    const seen = new Set<number>();
    let current = byId.get(groupId) ?? null;
    while (current && !seen.has(current.id)) {
        seen.add(current.id);
        chain.unshift(current);
        current = current.parentId === null ? null : byId.get(current.parentId) ?? null;
    }
    return chain;
}

function groupOptions(groups: WikiGroup[], parentId: number | null = null): { group: WikiGroup; depth: number }[] {
    const result: { group: WikiGroup; depth: number }[] = [];
    function walk(parent: number | null, depth: number) {
        for (const group of groups) {
            if (group.parentId !== parent) {
                continue;
            }
            result.push({ group, depth });
            walk(group.id, depth + 1);
        }
    }
    walk(parentId, 0);
    return result;
}

function clampWidth(value: number): number {
    return Math.min(TREE_MAX, Math.max(TREE_MIN, Math.round(value)));
}

function GroupBranch({
    group,
    groups,
    articles,
    activeId,
    activeGroupId,
    closed,
    filtering,
    canWrite,
    hrefFor,
    onToggle,
    onCreate,
    onCollapseAll,
    onExpandAll,
    onNavigate,
    favoriteIds,
    favoriteBusy,
    onFavorite,
}: {
    group: WikiGroup;
    groups: WikiGroup[];
    articles: WikiArticleSummary[];
    activeId: number | null;
    activeGroupId: number | null;
    closed: Set<number>;
    filtering: boolean;
    canWrite: boolean;
    hrefFor: (id: number) => string;
    onToggle: (id: number) => void;
    onCreate: (parentId: number) => void;
    onCollapseAll: () => void;
    onExpandAll: () => void;
    onNavigate: () => void;
    favoriteIds: Set<number>;
    favoriteBusy: number | null;
    onFavorite: (item: WikiArticleSummary) => void;
}) {
    const children = groups.filter((item) => item.parentId === group.id && (!filtering || branchHasArticles(item, groups, articles)));
    const own = articles.filter((item) => item.groupId === group.id);
    const open = !closed.has(group.id);
    return (
        <li id={`wiki-group-${group.id}`} className="flex flex-col">
            <div className="group/row flex items-center">
                <ContextMenu>
                    <ContextMenuTrigger
                        render={
                            <button
                                type="button"
                                className={cn(
                                    "flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-1 text-left hover:bg-muted",
                                    group.id === activeGroupId && "bg-muted font-medium",
                                )}
                                aria-expanded={open}
                                onClick={() => onToggle(group.id)}
                            />
                        }
                    >
                        <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                        {open ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
                        <span className="truncate">{group.title}</span>
                    </ContextMenuTrigger>
                    <ContextMenuContent>
                        <ContextMenuGroup>
                            <ContextMenuLabel className="max-w-56 truncate">{group.title}</ContextMenuLabel>
                            {canWrite ? (
                                <ContextMenuItem onClick={() => onCreate(group.id)}>
                                    <FolderPlus />
                                    Подгруппа
                                </ContextMenuItem>
                            ) : null}
                        </ContextMenuGroup>
                        <ContextMenuSeparator />
                        <ContextMenuGroup>
                            <ContextMenuItem onClick={() => onToggle(group.id)}>
                                {open ? <ChevronsDownUp /> : <ChevronsUpDown />}
                                {open ? "Свернуть ветку" : "Развернуть ветку"}
                            </ContextMenuItem>
                            <ContextMenuItem onClick={onCollapseAll}>
                                <ChevronsDownUp />
                                Свернуть всё
                            </ContextMenuItem>
                            <ContextMenuItem onClick={onExpandAll}>
                                <ChevronsUpDown />
                                Развернуть всё
                            </ContextMenuItem>
                        </ContextMenuGroup>
                    </ContextMenuContent>
                </ContextMenu>
                {canWrite ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                        aria-label={`Подгруппа в «${group.title}»`}
                        onClick={() => onCreate(group.id)}
                    >
                        <FolderPlus />
                    </Button>
                ) : null}
            </div>
            {open ? (
                <ul className="ml-3 flex flex-col border-l pl-1">
                    {own.map((item) => (
                        <li key={item.id} className="group/article flex items-center">
                            <Link
                                id={`wiki-article-${item.id}`}
                                href={hrefFor(item.id)}
                                onClick={onNavigate}
                                className={cn(
                                    "flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted",
                                    item.id === activeId && "bg-muted font-medium",
                                )}
                            >
                                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="truncate">{articleLabel(item)}</span>
                            </Link>
                            <FavoriteButton
                                active={favoriteIds.has(item.id)}
                                pending={favoriteBusy === item.id}
                                size="icon-xs"
                                className={cn(
                                    "opacity-0 group-hover/article:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100",
                                    (favoriteIds.has(item.id) || favoriteBusy === item.id) && "opacity-100",
                                )}
                                onClick={() => onFavorite(item)}
                            />
                        </li>
                    ))}
                    {canWrite && !filtering && own.length === 0 && children.length === 0 ? (
                        <li>
                            <Link
                                href={`/wiki/new?group=${group.id}`}
                                onClick={onNavigate}
                                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
                            >
                                <FilePlus className="size-3.5 shrink-0" />
                                <span className="truncate">Добавить статью</span>
                            </Link>
                        </li>
                    ) : null}
                    {children.map((child) => (
                        <GroupBranch
                            key={child.id}
                            group={child}
                            groups={groups}
                            articles={articles}
                            activeId={activeId}
                            activeGroupId={activeGroupId}
                            closed={closed}
                            filtering={filtering}
                            canWrite={canWrite}
                            hrefFor={hrefFor}
                            onToggle={onToggle}
                            onCreate={onCreate}
                            onCollapseAll={onCollapseAll}
                            onExpandAll={onExpandAll}
                            onNavigate={onNavigate}
                            favoriteIds={favoriteIds}
                            favoriteBusy={favoriteBusy}
                            onFavorite={onFavorite}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

function GroupDialog({
    open,
    parentId,
    groups,
    onOpenChange,
    onCreated,
}: {
    open: boolean;
    parentId: number | null;
    groups: WikiGroup[];
    onOpenChange: (open: boolean) => void;
    onCreated: () => void;
}) {
    const [title, setTitle] = useState("");
    const [parent, setParent] = useState<number | null>(parentId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const options = groupOptions(groups);

    useEffect(() => {
        if (!open) {
            return;
        }
        setTitle("");
        setParent(parentId);
        setError(null);
    }, [open, parentId]);

    async function create() {
        setSaving(true);
        setError(null);
        try {
            const rolesResponse = await fetch("/api/content/roles");
            const rolesJson = (await rolesResponse.json()) as ApiResponse<{ id: number; name: string }[]>;
            if (!rolesJson.success) {
                setError(rolesJson.error.message);
                return;
            }
            const response = await fetch("/api/wiki/groups", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, parentId: parent, roleIds: rolesJson.data.map((role) => role.id) }),
            });
            const json = (await response.json()) as ApiResponse<unknown>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            onOpenChange(false);
            onCreated();
        } catch {
            setError("Не удалось создать группу");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
            <DialogContent>
                <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void create();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{parent === null ? "Новая группа" : "Новая подгруппа"}</DialogTitle>
                        <DialogDescription>
                            {parent === null ? "Группа появится в корне списка." : "Подгруппа появится внутри выбранной группы."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="wiki-group-title">Название</Label>
                        <Input id="wiki-group-title" value={title} autoFocus disabled={saving} onChange={(event) => setTitle(event.target.value)} />
                    </div>
                    {groups.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            <Label>Внутри группы</Label>
                            <Select value={parent === null ? "root" : String(parent)} disabled={saving} onValueChange={(value) => setParent(!value || value === "root" ? null : Number(value))}>
                                <SelectTrigger className="w-full" aria-label="Внутри группы">
                                    <SelectValue placeholder="В корне">
                                        {(value) => !value || value === "root" ? "В корне" : groups.find((group) => String(group.id) === value)?.title ?? "В корне"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="root">В корне</SelectItem>
                                    {options.map((option) => (
                                        <SelectItem key={option.group.id} value={String(option.group.id)}>
                                            <span style={{ paddingLeft: option.depth * 12 }}>{option.group.title}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                    {error ? <FormAlert message={error} /> : null}
                    <DialogFooter>
                        <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Отмена</Button>
                        <Button type="submit" disabled={saving || title.trim() === ""}>
                            {saving ? <ButtonSpinner /> : null}
                            Создать
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ArticleActions({
    draft,
    archived,
    pending,
    onPublish,
    onEdit,
    onArchive,
    onDelete,
    labelled = false,
}: {
    draft: boolean;
    archived: boolean;
    pending: boolean;
    onPublish: () => void;
    onEdit: () => void;
    onArchive: () => void;
    onDelete: () => void;
    labelled?: boolean;
}) {
    const archiveLabel = archived ? "Вернуть из архива" : "В архив";
    if (labelled) {
        return (
            <>
                {draft ? (
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-start" disabled={pending} onClick={onPublish}>
                        <Send />
                        <span className="truncate">Опубликовать</span>
                    </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" className="w-full justify-start" disabled={pending} onClick={onEdit}>
                    <Pencil />
                    <span className="truncate">Редактировать</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-start" disabled={pending} onClick={onArchive}>
                    {archived ? <ArchiveRestore /> : <Archive />}
                    <span className="truncate">{archiveLabel}</span>
                </Button>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-start text-destructive hover:text-destructive" disabled={pending} onClick={onDelete}>
                    <Trash2 />
                    <span className="truncate">Удалить</span>
                </Button>
            </>
        );
    }
    return (
        <div className="flex shrink-0 items-center">
            {draft ? (
                <TreeAction label="Опубликовать" disabled={pending} onClick={onPublish}>
                    <Send />
                </TreeAction>
            ) : null}
            <TreeAction label="Редактировать" disabled={pending} onClick={onEdit}>
                <Pencil />
            </TreeAction>
            <TreeAction label={archiveLabel} disabled={pending} onClick={onArchive}>
                {archived ? <ArchiveRestore /> : <Archive />}
            </TreeAction>
            <TreeAction label="Удалить" variant="destructive" disabled={pending} onClick={onDelete}>
                <Trash2 />
            </TreeAction>
        </div>
    );
}

function ArticleStatus({ article }: { article: WikiArticle }) {
    const published = article.status !== "draft";
    const changed = Math.abs(new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime()) > 60_000;
    const scheduled = article.status === "published" && new Date(article.publishedAt).getTime() > Date.now();
    const author = articleAuthor(article);
    return (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1" title={`Автор: ${author}`}>
                <UserRound className="size-3.5 shrink-0" aria-hidden />
                <span className="sr-only">Автор: </span>
                <span className="truncate">{author}</span>
            </span>
            {published ? (
                <span className="inline-flex items-center gap-1" title={`Опубликована: ${wikiWhen(article.publishedAt)}`}>
                    <Calendar className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">Опубликована: </span>
                    {wikiWhen(article.publishedAt)}
                </span>
            ) : null}
            {article.status === "draft" || changed ? (
                <span className="inline-flex items-center gap-1" title={`Изменена: ${wikiWhen(article.updatedAt)}`}>
                    <Clock className="size-3.5 shrink-0" aria-hidden />
                    <span className="sr-only">Изменена: </span>
                    {wikiWhen(article.updatedAt)}
                </span>
            ) : null}
            {article.status === "draft" ? <span>Черновик</span> : null}
            {scheduled ? <span>Отложена</span> : null}
            {article.archived ? <span>Архив</span> : null}
        </p>
    );
}

function articleAuthor(article: WikiArticle): string {
    if (!article.authorName) {
        return article.author;
    }
    return article.authorTitle ? `${article.authorName}, ${article.authorTitle}` : article.authorName;
}

function wikiWhen(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return date.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function confirmTitle(kind: "archive" | "restore" | "delete"): string {
    if (kind === "delete") return "Удалить статью?";
    if (kind === "restore") return "Вернуть статью из архива?";
    return "Поместить статью в архив?";
}

function confirmLabel(kind: "archive" | "restore" | "delete"): string {
    if (kind === "delete") return "Удалить";
    if (kind === "restore") return "Вернуть";
    return "В архив";
}

function confirmText(kind: "archive" | "restore" | "delete", title: string): string {
    if (kind === "delete") return `«${title}» будет удалена без возможности восстановления.`;
    if (kind === "restore") return `«${title}» снова станет обычной статьёй.`;
    return `«${title}» останется в списке и будет отмечена как архивная.`;
}

function ScrollTop({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = targetRef.current;
        function onScroll() {
            const column = node?.scrollTop ?? 0;
            setVisible(Math.max(column, window.scrollY) > 280);
        }
        node?.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => {
            node?.removeEventListener("scroll", onScroll);
            window.removeEventListener("scroll", onScroll);
        };
    }, [targetRef]);

    if (!visible) {
        return null;
    }

    return (
        <Button
            type="button"
            size="icon"
            variant="outline"
            className="fixed bottom-4 right-4 z-30 shadow-md lg:right-[17rem]"
            aria-label="Наверх"
            onClick={() => {
                const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
                const node = targetRef.current;
                if (node && node.scrollTop > 0) {
                    node.scrollTo({ top: 0, behavior });
                }
                window.scrollTo({ top: 0, behavior });
            }}
        >
            <ArrowUp />
        </Button>
    );
}
