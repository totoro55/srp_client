"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Eye, List, PenLine, Save, Send } from "lucide-react";
import { PageHeading } from "@/app/_components/header/page-heading";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarTrigger,
} from "@/components/ui/menubar";
import { ButtonSpinner, FormSkeleton } from "@/components/loading-state";
import { emptyNewsDocument, plainTextDocument, type NewsNode } from "@/lib/news-document";
import { notifySuccess } from "@/lib/notify";
import { newsAuthorLine, type NewsStatus } from "@/lib/news";
import { ApiResponse } from "@/types/api";
import { NewsArticle } from "./NewsArticle";
import { NewsEditor, type EditorMenuAction } from "./NewsEditor";
import { RolePicker, type RoleOption } from "./RolePicker";
import { useUnsavedChanges } from "./unsaved-changes";

interface NewsPost {
    id: number;
    title: string;
    body: string;
    document: NewsNode | null;
    status: NewsStatus;
    publishedAt: string;
    author: string;
    authorName: string | null;
    authorTitle: string | null;
    roleIds: number[];
}

export function NewsForm({ postId = null }: { postId?: number | null }) {
    const router = useRouter();
    const { data: session } = useSession();
    const savedId = useRef<number | null>(postId);
    const [storedStatus, setStoredStatus] = useState<NewsStatus>("draft");
    const [title, setTitle] = useState("");
    const [content, setContent] = useState<NewsNode>(emptyNewsDocument());
    const [publishedAt, setPublishedAt] = useState(localStamp());
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [authorLine, setAuthorLine] = useState<string | null>(null);
    const [roles, setRoles] = useState<RoleOption[] | null>(null);
    const [rolesError, setRolesError] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(postId === null);
    const [generation, setGeneration] = useState(0);
    const [missing, setMissing] = useState(false);
    const [preview, setPreview] = useState(false);
    const [previewMenu, setPreviewMenu] = useState(false);
    const [draftOpen, setDraftOpen] = useState(false);
    const [publishOpen, setPublishOpen] = useState(false);
    const [draftTitle, setDraftTitle] = useState("");
    const [publishTitle, setPublishTitle] = useState("");
    const [publishDate, setPublishDate] = useState(localStamp());
    const [publishRoles, setPublishRoles] = useState<number[]>([]);
    const [saving, setSaving] = useState<NewsStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savedContent, setSavedContent] = useState(() => JSON.stringify(emptyNewsDocument()));
    const contentDirty = JSON.stringify(content) !== savedContent;
    const draftDirty = draftOpen && draftTitle.trim() !== title.trim();
    const publishDirty = publishOpen && (publishTitle.trim() !== title.trim() || publishDate !== publishedAt || publishRoles.join(",") !== roleIds.join(","));
    const { leave, dialog: unsavedDialog } = useUnsavedChanges(loaded && !missing && (contentDirty || draftDirty || publishDirty));

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
        if (postId === null) {
            return;
        }
        const controller = new AbortController();
        void fetch(`/api/news/${postId}`, { signal: controller.signal })
            .then(async (response) => {
                const json = (await response.json()) as ApiResponse<NewsPost>;
                if (!json.success) {
                    setMissing(true);
                    setError(json.error.message);
                    return;
                }
                const nextContent = json.data.document ?? plainTextDocument(json.data.body);
                setTitle(json.data.title);
                setContent(nextContent);
                setSavedContent(JSON.stringify(nextContent));
                setGeneration((value) => value + 1);
                setPublishedAt(localStamp(json.data.publishedAt));
                setRoleIds(json.data.roleIds);
                setAuthorLine(newsAuthorLine(json.data));
                setStoredStatus(json.data.status);
            })
            .catch((reason: unknown) => {
                if (reason instanceof DOMException && reason.name === "AbortError") return;
                setError("Не удалось загрузить новость");
            })
            .finally(() => setLoaded(true));
        return () => controller.abort();
    }, [postId]);

    function openDraft() {
        setDraftTitle(title);
        setError(null);
        setDraftOpen(true);
    }

    function openPublish() {
        setPublishTitle(title);
        setPublishDate(publishedAt);
        setPublishRoles(roleIds);
        setError(null);
        setPublishOpen(true);
    }

    async function save(status: NewsStatus, fields: { title: string; publishedAt: string; roleIds: number[] }) {
        const nextTitle = fields.title.trim();
        if (nextTitle.length === 0) {
            setError("Укажите заголовок");
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
            const response = await fetch(id === null ? "/api/news" : `/api/news/${id}`, {
                method: id === null ? "POST" : "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: nextTitle,
                    document: content,
                    publishedAt: new Date(fields.publishedAt).toISOString(),
                    roleIds: fields.roleIds,
                    status,
                }),
            });
            const json = (await response.json()) as ApiResponse<NewsPost>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTitle(nextTitle);
            setPublishedAt(fields.publishedAt);
            setRoleIds(fields.roleIds);
            setSavedContent(JSON.stringify(content));
            setDraftOpen(false);
            setPublishOpen(false);
            if (status === "draft") {
                notifySuccess("Черновик сохранён");
                savedId.current = json.data.id;
                setStoredStatus("draft");
                if (postId === null) {
                    router.replace(`/news/${json.data.id}/edit`);
                }
                return;
            }
            notifySuccess(storedStatus === "published" ? "Новость обновлена" : "Новость опубликована");
            router.push(`/news/${json.data.id}`);
        } catch {
            setError(status === "draft" ? "Не удалось сохранить черновик" : "Не удалось опубликовать новость");
        } finally {
            setSaving(null);
        }
    }

    const heading = preview ? "Предпросмотр" : postId === null ? "Новая новость" : "Изменить новость";

    if (!loaded) {
        return (
            <>
                <PageHeading trail={[{ href: "/news", label: "Новости" }, { label: heading }]} />
                <FormSkeleton fields={4} />
            </>
        );
    }

    if (missing) {
        return (
            <>
                <PageHeading trail={[{ href: "/news", label: "Новости" }, { label: "Новость" }]} />
                <FormAlert message={error} />
            </>
        );
    }

    const editorMenu: EditorMenuAction[] = [
        { label: "Сохранить черновик", icon: Save, disabled: saving !== null, run: openDraft },
        { label: "Предпросмотр", icon: Eye, disabled: saving !== null, run: () => { setError(null); setPreview(true); } },
        { label: "К списку", icon: List, run: () => leave("/news") },
    ];

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 w-full flex-col overflow-hidden">
            {unsavedDialog}
            <PageHeading trail={[{ href: "/news", label: "Новости" }, { label: heading }]} />
            {preview ? (
                <div className="flex shrink-0 items-center border-b bg-background px-2">
                    <Menubar className="h-10 w-full justify-start rounded-none border-0 bg-transparent px-0 shadow-none">
                        <MenubarMenu open={previewMenu} onOpenChange={setPreviewMenu}>
                            <MenubarTrigger className="whitespace-nowrap">Новость</MenubarTrigger>
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
                        <p className="text-sm text-muted-foreground">Так новость будет выглядеть после публикации.</p>
                        <NewsArticle
                            title={title.trim() || "Без названия"}
                            publishedAt={new Date(publishedAt).toISOString()}
                            authorLine={authorLine ?? session?.user.displayName ?? ""}
                            status="published"
                            content={content}
                            plain=""
                        />
                    </div>
                </div>
            ) : (
                <NewsEditor content={content} loadKey={`${postId === null ? "new" : postId}:${generation}`} editable onChange={setContent} newsMenu={editorMenu} />
            )}
            <Dialog open={draftOpen} onOpenChange={(open) => { if (saving === null) setDraftOpen(open); }}>
                <DialogContent>
                    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void save("draft", { title: draftTitle, publishedAt, roleIds }); }}>
                        <DialogHeader>
                            <DialogTitle>Сохранить черновик</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="draft-title">Заголовок</Label>
                            <Input id="draft-title" value={draftTitle} autoFocus onChange={(event) => setDraftTitle(event.target.value)} />
                        </div>
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
                <DialogContent className="sm:max-w-lg">
                    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void save("published", { title: publishTitle, publishedAt: publishDate, roleIds: publishRoles }); }}>
                        <DialogHeader>
                            <DialogTitle>Опубликовать новость</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="publish-title">Заголовок</Label>
                            <Input id="publish-title" value={publishTitle} autoFocus onChange={(event) => setPublishTitle(event.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="publish-date">Дата публикации</Label>
                            <Input id="publish-date" type="datetime-local" value={publishDate} onChange={(event) => setPublishDate(event.target.value)} />
                        </div>
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

function localStamp(iso?: string): string {
    const date = iso ? new Date(iso) : new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
