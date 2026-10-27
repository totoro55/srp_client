"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronRight, Eye, FileText, Folder, FolderOpen, List, PenLine, Save, Send } from "lucide-react";
import { PageHeading } from "@/app/_components/header/page-heading";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { ButtonSpinner, FormSkeleton } from "@/components/loading-state";
import { notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { emptyWikiDocument, type WikiNode } from "@/lib/wiki-document";
import { ApiResponse } from "@/types/api";
import { NewsArticle } from "../../news/_components/NewsArticle";
import { NewsEditor, type EditorMenuAction } from "../../news/_components/NewsEditor";
import { RolePicker, type RoleOption } from "../../news/_components/RolePicker";
import { ArticleBrief } from "./ArticleBrief";

interface WikiGroup {
    id: number;
    parentId: number | null;
    title: string;
}

interface PickerArticle {
    id: number;
    groupId: number;
    title: string;
    status: "draft" | "published";
    archived: boolean;
}

interface WikiArticle {
    id: number;
    groupId: number;
    title: string;
    document: WikiNode;
    roleIds: number[];
    status: "draft" | "published";
    publishedAt: string;
    tags: string[];
    summary: string;
}

export function WikiForm({ articleId = null }: { articleId?: number | null }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const groupParam = searchParams.get("group");
    const requestedGroup = groupParam !== null && /^\d+$/.test(groupParam) ? Number(groupParam) : null;
    const { data: session } = useSession();
    const savedId = useRef<number | null>(articleId);
    const publishOnce = useRef(false);
    const publishOnOpen = useRef(searchParams.get("publish") === "1");
    const [storedStatus, setStoredStatus] = useState<"draft" | "published">("draft");
    const [title, setTitle] = useState("");
    const [document, setDocument] = useState<WikiNode>(emptyWikiDocument());
    const [groupId, setGroupId] = useState<number | null>(null);
    const [publishedAt, setPublishedAt] = useState(localStamp());
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [summary, setSummary] = useState("");
    const [knownTags, setKnownTags] = useState<string[]>([]);
    const [groups, setGroups] = useState<WikiGroup[]>([]);
    const [articles, setArticles] = useState<PickerArticle[]>([]);
    const [roles, setRoles] = useState<RoleOption[] | null>(null);
    const [rolesError, setRolesError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(articleId === null);
    const [generation, setGeneration] = useState(0);
    const [missing, setMissing] = useState(false);
    const [preview, setPreview] = useState(false);
    const [previewMenu, setPreviewMenu] = useState(false);
    const [draftOpen, setDraftOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [draftTitle, setDraftTitle] = useState("");
    const [draftGroup, setDraftGroup] = useState<number | null>(null);
    const [publishTitle, setPublishTitle] = useState("");
    const [publishDate, setPublishDate] = useState(localStamp());
    const [publishGroup, setPublishGroup] = useState<number | null>(null);
    const [publishRoles, setPublishRoles] = useState<number[]>([]);
    const [draftTags, setDraftTags] = useState<string[]>([]);
    const [publishTags, setPublishTags] = useState<string[]>([]);
    const [saving, setSaving] = useState<"draft" | "published" | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        void fetch("/api/content/roles", { signal: controller.signal })
            .then(async (response) => {
                const json = (await response.json()) as ApiResponse<RoleOption[]>;
                if (!json.success) {
                    setRolesError(json.error.message);
                    setRoles([]);
                    return;
                }
                setRoles(json.data);
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setRolesError("Не удалось загрузить роли");
                setRoles([]);
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        void (async () => {
            try {
                const list = await fetch("/api/wiki", { signal: controller.signal });
                const tree = (await list.json()) as ApiResponse<{ groups: WikiGroup[]; articles: PickerArticle[]; tags: string[] }>;
                if (!tree.success) {
                    setError(tree.error.message);
                    return;
                }
                setGroups(tree.data.groups);
                setArticles(tree.data.articles ?? []);
                setKnownTags(tree.data.tags ?? []);
                if (articleId === null) {
                    setGroupId((current) => {
                        if (current !== null) {
                            return current;
                        }
                        if (requestedGroup !== null && tree.data.groups.some((group) => group.id === requestedGroup)) {
                            return requestedGroup;
                        }
                        return tree.data.groups[0]?.id ?? null;
                    });
                    return;
                }
                const response = await fetch(`/api/wiki/articles/${articleId}`, { signal: controller.signal });
                const json = (await response.json()) as ApiResponse<WikiArticle>;
                if (!json.success) {
                    setMissing(true);
                    setError(json.error.message);
                    return;
                }
                const stamp = localStamp(json.data.publishedAt);
                const articleTags = json.data.tags ?? [];
                setTitle(json.data.title);
                setGroupId(json.data.groupId);
                setDocument(json.data.document);
                setGeneration((value) => value + 1);
                setPublishedAt(stamp);
                setRoleIds(json.data.roleIds);
                setTags(articleTags);
                setSummary(json.data.summary ?? "");
                setStoredStatus(json.data.status);
                if (!publishOnce.current && publishOnOpen.current && json.data.status === "draft") {
                    publishOnce.current = true;
                    setPreview(true);
                    setPublishTitle(json.data.title);
                    setPublishDate(stamp);
                    setPublishGroup(json.data.groupId);
                    setPublishRoles(json.data.roleIds);
                    setPublishTags(articleTags);
                    setError(null);
                    setPublishOpen(true);
                    router.replace(`/wiki/${articleId}/edit`);
                }
            } catch (reason: unknown) {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setError("Не удалось загрузить статью");
            } finally {
                if (!controller.signal.aborted) {
                    setLoaded(true);
                }
            }
        })();
        return () => controller.abort();
    }, [articleId, requestedGroup, router]);

    function openDraft() {
        setDraftTitle(title);
        setDraftGroup(groupId);
        setDraftTags(tags);
        setError(null);
        setDraftOpen(true);
    }

    function openPublish() {
        setPublishTitle(title);
        setPublishDate(publishedAt);
        setPublishGroup(groupId);
        setPublishRoles(roleIds);
        setPublishTags(tags);
        setError(null);
        setPublishOpen(true);
    }

    async function save(
        status: "draft" | "published",
        fields: { title: string; publishedAt: string; roleIds: number[]; groupId: number | null; tags: string[]; summary: string },
    ) {
        const nextTitle = fields.title.trim();
        const nextSummary = fields.summary.trim();
        if (nextTitle.length === 0) {
            setError("Укажите заголовок");
            return;
        }
        if (status === "published" && nextSummary.length === 0) {
            setError("Укажите краткое содержание");
            return;
        }
        if (fields.groupId === null) {
            setError("Сначала создайте группу");
            return;
        }
        if (status === "published" && (!fields.publishedAt || Number.isNaN(new Date(fields.publishedAt).getTime()))) {
            setError("Укажите дату публикации");
            return;
        }
        if (status === "published" && fields.roleIds.length === 0) {
            setError("Выберите хотя бы одну роль");
            return;
        }
        setSaving(status);
        setError(null);
        const id = savedId.current;
        try {
            const response = await fetch(id === null ? "/api/wiki/articles" : `/api/wiki/articles/${id}`, {
                method: id === null ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: nextTitle,
                    groupId: fields.groupId,
                    document,
                    publishedAt: new Date(fields.publishedAt).toISOString(),
                    roleIds: fields.roleIds,
                    tags: fields.tags,
                    summary: nextSummary,
                    status,
                }),
            });
            const json = (await response.json()) as ApiResponse<WikiArticle>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTitle(nextTitle);
            setGroupId(fields.groupId);
            setPublishedAt(fields.publishedAt);
            setRoleIds(fields.roleIds);
            setTags(fields.tags);
            setSummary(nextSummary);
            setDraftOpen(false);
            setPublishOpen(false);
            if (status === "draft") {
                notifySuccess("Черновик сохранён");
                savedId.current = json.data.id;
                setStoredStatus("draft");
                if (articleId === null) {
                    router.replace(`/wiki/${json.data.id}/edit`);
                }
                return;
            }
            notifySuccess(storedStatus === "published" ? "Статья обновлена" : "Статья опубликована");
            router.push(`/wiki/${json.data.id}`);
        } catch {
            setError(status === "draft" ? "Не удалось сохранить черновик" : "Не удалось опубликовать статью");
        } finally {
            setSaving(null);
        }
    }

    const heading = preview ? "Предпросмотр" : articleId === null ? "Новая статья" : "Изменить статью";

    if (!loaded) {
        return (
            <>
                <PageHeading trail={[{ href: "/wiki", label: "База знаний" }, { label: heading }]} />
                <FormSkeleton fields={4} />
            </>
        );
    }

    if (missing) {
        return (
            <>
                <PageHeading trail={[{ href: "/wiki", label: "База знаний" }, { label: "Статья" }]} />
                <FormAlert message={error} />
            </>
        );
    }

    const editorMenu: EditorMenuAction[] = [
        { label: "Сохранить черновик", icon: Save, disabled: saving !== null, run: openDraft },
        ...(storedStatus === "draft" ? [{ label: "Опубликовать", icon: Send, disabled: saving !== null, run: () => { openPublish(); setPreview(true); } }] : []),
        { label: "Предпросмотр", icon: Eye, disabled: saving !== null, run: () => { setError(null); setPreview(true); } },
        { label: "К списку", icon: List, run: () => router.push("/wiki") },
    ];

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col overflow-hidden">
            <PageHeading trail={[{ href: "/wiki", label: "База знаний" }, { label: heading }]} />
            {preview ? (
                <div className="flex shrink-0 items-center border-b bg-background px-2">
                    <Menubar className="h-10 w-full justify-start rounded-none border-0 bg-transparent px-0 shadow-none">
                        <MenubarMenu open={previewMenu} onOpenChange={setPreviewMenu}>
                            <MenubarTrigger className="whitespace-nowrap">Статья</MenubarTrigger>
                            <MenubarContent className="w-max! min-w-64 whitespace-nowrap">
                                <MenubarItem className="whitespace-nowrap" disabled={saving !== null} onClick={() => { setPreviewMenu(false); setPreview(false); }}>
                                    <PenLine />
                                    К редактированию
                                </MenubarItem>
                                <MenubarItem className="whitespace-nowrap" disabled={saving !== null} onClick={() => { setPreviewMenu(false); openPublish(); }}>
                                    <Send />
                                    Опубликовать
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                    </Menubar>
                </div>
            ) : null}
            {preview ? (
                <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40 px-4 py-8 sm:px-8">
                    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                        <p className="text-sm text-muted-foreground">Так статья будет выглядеть после публикации.</p>
                        <ArticleBrief text={summary} />
                        <NewsArticle
                            title={title.trim() || "Без названия"}
                            publishedAt={new Date(publishedAt).toISOString()}
                            authorLine={session?.user.displayName ?? ""}
                            status="published"
                            content={document}
                            plain=""
                            assetsUrl="/api/wiki/assets"
                            placeholder="Текст статьи"
                            anchorLinks
                            anchorPage={articleId ? `/wiki/${articleId}` : ""}
                        />
                    </div>
                </div>
            ) : (
                <NewsEditor
                    content={document}
                    loadKey={`${articleId ?? "new"}:${generation}`}
                    editable
                    assetsUrl="/api/wiki/assets"
                    placeholder="Текст статьи"
                    anchorLinks
                    anchorPage={articleId ? `/wiki/${articleId}` : ""}
                    menuLabel="Статья"
                    onChange={setDocument}
                    newsMenu={editorMenu}
                />
            )}
            <Dialog open={draftOpen} onOpenChange={(open) => { if (saving === null) setDraftOpen(open); }}>
                <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-lg">
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save("draft", { title: draftTitle, publishedAt, roleIds, groupId: draftGroup, tags: draftTags, summary });
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>Сохранить черновик</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="draft-title">Заголовок</Label>
                            <Input id="draft-title" value={draftTitle} autoFocus onChange={(event) => setDraftTitle(event.target.value)} />
                        </div>
                        <SummaryField value={summary} disabled={saving !== null} onChange={setSummary} />
                        <GroupField groups={groups} articles={articles} value={draftGroup} disabled={saving !== null} onChange={setDraftGroup} />
                        <TagField tags={draftTags} known={knownTags} disabled={saving !== null} onChange={setDraftTags} />
                        {error ? <FormAlert message={error} /> : null}
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={saving !== null} onClick={() => setDraftOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={saving !== null}>
                                {saving === "draft" ? <ButtonSpinner /> : null}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Dialog open={publishOpen} disablePointerDismissal onOpenChange={(open) => { if (saving === null) setPublishOpen(open); }}>
                <DialogContent className="max-h-[min(42rem,calc(100dvh-2rem))] overflow-y-auto sm:max-w-lg">
                    <form
                        className="grid gap-4"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save("published", { title: publishTitle, publishedAt: publishDate, roleIds: publishRoles, groupId: publishGroup, tags: publishTags, summary });
                        }}
                    >
                        <DialogHeader>
                            <DialogTitle>Опубликовать статью</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="publish-title">Заголовок</Label>
                            <Input id="publish-title" value={publishTitle} autoFocus onChange={(event) => setPublishTitle(event.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="publish-date">Дата публикации</Label>
                            <Input id="publish-date" type="datetime-local" value={publishDate} onChange={(event) => setPublishDate(event.target.value)} />
                        </div>
                        <SummaryField value={summary} disabled={saving !== null} required onChange={setSummary} />
                        <GroupField groups={groups} articles={articles} value={publishGroup} disabled={saving !== null} onChange={setPublishGroup} />
                        <TagField tags={publishTags} known={knownTags} disabled={saving !== null} onChange={setPublishTags} />
                        <div className="flex flex-col gap-1.5">
                            <Label>Кто видит</Label>
                            <RolePicker roles={roles} rolesError={rolesError} selected={publishRoles} disabled={saving !== null} onChange={setPublishRoles} />
                        </div>
                        {error ? <FormAlert message={error} /> : null}
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={saving !== null} onClick={() => setPublishOpen(false)}>Отмена</Button>
                            <Button type="submit" disabled={saving !== null}>
                                {saving === "published" ? <ButtonSpinner /> : null}
                                Опубликовать
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function SummaryField({
    value,
    disabled,
    required = false,
    onChange,
}: {
    value: string;
    disabled: boolean;
    required?: boolean;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={required ? "publish-summary" : "draft-summary"}>Краткое содержание</Label>
            <Textarea
                id={required ? "publish-summary" : "draft-summary"}
                value={value}
                required={required}
                disabled={disabled}
                maxLength={2000}
                placeholder="О чём эта статья"
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function TagField({
    tags,
    known,
    disabled,
    onChange,
}: {
    tags: string[];
    known: string[];
    disabled: boolean;
    onChange: (tags: string[]) => void;
}) {
    const [draft, setDraft] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const needle = draft.trim().toLowerCase();
    const taken = new Set(tags.map((tag) => tag.toLowerCase()));
    const suggestions = known
        .filter((tag) => needle.length > 0 && !taken.has(tag.toLowerCase()) && tag.toLowerCase().includes(needle))
        .sort((left, right) => {
            const leftRank = left.toLowerCase().startsWith(needle) ? 0 : 1;
            const rightRank = right.toLowerCase().startsWith(needle) ? 0 : 1;
            return leftRank - rightRank || left.localeCompare(right, "ru");
        })
        .slice(0, 8);
    const exact = known.find((tag) => tag.toLowerCase() === needle);
    const canCreate = needle.length > 0 && !exact && !taken.has(needle) && tags.length < 12;
    const options = [...suggestions, ...(canCreate ? [draft.trim().replace(/\s+/g, " ")] : [])];

    function add(raw: string) {
        const typed = raw.trim().replace(/\s+/g, " ");
        const existing = known.find((tag) => tag.toLowerCase() === typed.toLowerCase());
        const tag = existing ?? typed;
        if (tag.length === 0 || tags.some((item) => item.toLowerCase() === tag.toLowerCase()) || tags.length >= 12) {
            return;
        }
        onChange([...tags, tag]);
        setDraft("");
        setActive(0);
        setOpen(false);
    }

    return (
        <div className="flex flex-col gap-1.5">
            <Label>Теги</Label>
            {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                            disabled={disabled}
                            onClick={() => onChange(tags.filter((item) => item !== tag))}
                        >
                            {tag} ×
                        </button>
                    ))}
                </div>
            ) : null}
            <Input
                value={draft}
                placeholder="Найти или добавить тег"
                aria-label="Найти или добавить тег"
                aria-expanded={open && options.length > 0}
                aria-autocomplete="list"
                disabled={disabled || tags.length >= 12}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onChange={(event) => {
                    setDraft(event.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && options.length > 0) {
                        event.preventDefault();
                        setOpen(true);
                        setActive((index) => Math.min(index + 1, options.length - 1));
                        return;
                    }
                    if (event.key === "ArrowUp" && options.length > 0) {
                        event.preventDefault();
                        setActive((index) => Math.max(index - 1, 0));
                        return;
                    }
                    if (event.key === "Escape") {
                        setOpen(false);
                        return;
                    }
                    if (event.key === "Enter") {
                        event.preventDefault();
                        if (open && options[active]) {
                            add(options[active]);
                            return;
                        }
                        add(draft);
                    }
                }}
            />
            {open && options.length > 0 ? (
                <ul role="listbox" aria-label="Подходящие теги" className="max-h-40 overflow-y-auto rounded-md border">
                    {suggestions.map((tag, index) => (
                        <li key={tag}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={index === active}
                                className={cn("block w-full truncate px-2 py-1.5 text-left text-sm hover:bg-muted", index === active && "bg-muted")}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => add(tag)}
                            >
                                {tag}
                            </button>
                        </li>
                    ))}
                    {canCreate ? (
                        <li>
                            <button
                                type="button"
                                role="option"
                                aria-selected={active === suggestions.length}
                                className={cn("block w-full truncate px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted", active === suggestions.length && "bg-muted")}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => add(draft)}
                            >
                                Добавить «{draft.trim().replace(/\s+/g, " ")}»
                            </button>
                        </li>
                    ) : null}
                </ul>
            ) : null}
        </div>
    );
}

function GroupField({
    groups,
    articles,
    value,
    disabled,
    onChange,
}: {
    groups: WikiGroup[];
    articles: PickerArticle[];
    value: number | null;
    disabled: boolean;
    onChange: (groupId: number | null) => void;
}) {
    const [query, setQuery] = useState("");
    const [hideDrafts, setHideDrafts] = useState(false);
    const [hideArchived, setHideArchived] = useState(false);
    const [opened, setOpened] = useState<Set<number>>(() => ancestorIds(value, groups));
    const needle = query.trim().toLowerCase();
    const shown = articles.filter((item) => pickerArticleShown(item, hideDrafts, hideArchived));
    const roots = groups.filter((group) => group.parentId === null && groupVisible(group, groups, shown, needle));
    const path = groupPath(value, groups);

    function toggle(id: number) {
        setOpened((ids) => {
            const next = new Set(ids);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }

    function showSearch(nextQuery: string) {
        setQuery(nextQuery);
        const nextNeedle = nextQuery.trim().toLowerCase();
        if (nextNeedle.length === 0) {
            setOpened(ancestorIds(value, groups));
            return;
        }
        const visible = articles.filter((item) => pickerArticleShown(item, hideDrafts, hideArchived));
        const next = new Set<number>();
        for (const group of groups) {
            if (branchMatches(group, groups, visible, nextNeedle)) {
                next.add(group.id);
            }
        }
        setOpened(next);
    }

    return (
        <div className="flex flex-col gap-1.5">
            <Label>Группа</Label>
            <p className="truncate text-xs text-muted-foreground">{path.length > 0 ? path : "Группа не выбрана"}</p>
            <Input
                value={query}
                placeholder="Найти группу или статью"
                aria-label="Найти группу или статью"
                disabled={disabled}
                onChange={(event) => showSearch(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                    }
                }}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-2">
                <Label className="font-normal">
                    <Checkbox checked={hideDrafts} disabled={disabled} onCheckedChange={(next) => setHideDrafts(next === true)} />
                    Скрыть черновики
                </Label>
                <Label className="font-normal">
                    <Checkbox checked={hideArchived} disabled={disabled} onCheckedChange={(next) => setHideArchived(next === true)} />
                    Скрыть архив
                </Label>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-md border p-1">
                {groups.length === 0 ? <p className="px-2 py-1.5 text-sm text-muted-foreground">Групп пока нет.</p> : roots.length === 0 ? (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">Ничего не найдено.</p>
                ) : (
                    <ul className="flex flex-col gap-0.5">
                        {roots.map((group) => (
                            <GroupBranch
                                key={group.id}
                                group={group}
                                groups={groups}
                                articles={shown}
                                needle={needle}
                                opened={opened}
                                value={value}
                                disabled={disabled}
                                onToggle={toggle}
                                onSelect={onChange}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function GroupBranch({
    group,
    groups,
    articles,
    needle,
    opened,
    value,
    disabled,
    onToggle,
    onSelect,
}: {
    group: WikiGroup;
    groups: WikiGroup[];
    articles: PickerArticle[];
    needle: string;
    opened: Set<number>;
    value: number | null;
    disabled: boolean;
    onToggle: (id: number) => void;
    onSelect: (groupId: number) => void;
}) {
    const children = groups.filter((item) => item.parentId === group.id && groupVisible(item, groups, articles, needle));
    const own = articles.filter((item) => item.groupId === group.id && pickerArticleVisible(item, groups, needle));
    const nested = children.length > 0 || own.length > 0;
    const open = nested && opened.has(group.id);
    const selected = value === group.id;
    return (
        <li className="flex flex-col gap-0.5">
            <div className={cn("flex items-center gap-0.5 rounded-md", selected && "bg-primary/10")}>
                {nested ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="text-muted-foreground"
                        aria-label={open ? `Свернуть «${group.title}»` : `Развернуть «${group.title}»`}
                        aria-expanded={open}
                        disabled={disabled}
                        onClick={() => onToggle(group.id)}
                    >
                        <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
                    </Button>
                ) : <span className="size-6 shrink-0" aria-hidden />}
                <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted disabled:opacity-50"
                    onClick={() => onSelect(group.id)}
                >
                    {open ? <FolderOpen className="size-4 shrink-0 text-muted-foreground" /> : <Folder className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{group.title}</span>
                </button>
            </div>
            {open ? (
                <ul className="ml-5 flex flex-col gap-0.5 border-l pl-2">
                    {own.map((item) => (
                        <li key={item.id} className="flex items-center gap-2 px-1 py-1 text-muted-foreground">
                            <FileText className="size-3.5 shrink-0" />
                            <span className="truncate">{pickerArticleLabel(item)}</span>
                        </li>
                    ))}
                    {children.map((child) => (
                        <GroupBranch
                            key={child.id}
                            group={child}
                            groups={groups}
                            articles={articles}
                            needle={needle}
                            opened={opened}
                            value={value}
                            disabled={disabled}
                            onToggle={onToggle}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

function pickerArticleShown(item: PickerArticle, hideDrafts: boolean, hideArchived: boolean): boolean {
    if (hideDrafts && item.status === "draft") {
        return false;
    }
    if (hideArchived && item.archived) {
        return false;
    }
    return true;
}

function pickerArticleLabel(item: PickerArticle): string {
    return `${item.title}${item.status === "draft" ? " · Черновик" : ""}${item.archived ? " · Архив" : ""}`;
}

function groupVisible(group: WikiGroup, groups: WikiGroup[], articles: PickerArticle[], needle: string): boolean {
    if (needle.length === 0) {
        return true;
    }
    return branchMatches(group, groups, articles, needle) || ancestorTitleMatches(group, groups, needle);
}

function branchMatches(group: WikiGroup, groups: WikiGroup[], articles: PickerArticle[], needle: string): boolean {
    if (group.title.toLowerCase().includes(needle)) {
        return true;
    }
    if (articles.some((item) => item.groupId === group.id && item.title.toLowerCase().includes(needle))) {
        return true;
    }
    return groups.some((item) => item.parentId === group.id && branchMatches(item, groups, articles, needle));
}

function ancestorTitleMatches(group: WikiGroup, groups: WikiGroup[], needle: string): boolean {
    const byId = new Map(groups.map((item) => [item.id, item]));
    const seen = new Set<number>();
    let current = group.parentId === null ? undefined : byId.get(group.parentId);
    while (current && !seen.has(current.id)) {
        if (current.title.toLowerCase().includes(needle)) {
            return true;
        }
        seen.add(current.id);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return false;
}

function pickerArticleVisible(item: PickerArticle, groups: WikiGroup[], needle: string): boolean {
    if (needle.length === 0) {
        return true;
    }
    if (item.title.toLowerCase().includes(needle)) {
        return true;
    }
    const group = groups.find((entry) => entry.id === item.groupId);
    if (!group) {
        return false;
    }
    return group.title.toLowerCase().includes(needle) || ancestorTitleMatches(group, groups, needle);
}

function ancestorIds(groupId: number | null, groups: WikiGroup[]): Set<number> {
    const ids = new Set<number>();
    if (groupId === null) {
        return ids;
    }
    const byId = new Map(groups.map((group) => [group.id, group]));
    const seen = new Set<number>();
    let current = byId.get(groupId);
    if (current) {
        seen.add(current.id);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    while (current && !seen.has(current.id)) {
        ids.add(current.id);
        seen.add(current.id);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return ids;
}

function groupPath(groupId: number | null, groups: WikiGroup[]): string {
    if (groupId === null) {
        return "";
    }
    const byId = new Map(groups.map((group) => [group.id, group]));
    const chain: string[] = [];
    const seen = new Set<number>();
    let current = byId.get(groupId);
    while (current && !seen.has(current.id)) {
        chain.unshift(current.title);
        seen.add(current.id);
        current = current.parentId === null ? undefined : byId.get(current.parentId);
    }
    return chain.join(" / ");
}

function localStamp(iso?: string): string {
    const date = iso ? new Date(iso) : new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
