"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";
import { RoleChecks } from "../../_components/RoleChecks";

interface NewsPost {
    id: number;
    title: string;
    body: string;
    publishedAt: string;
    author: string;
    roleIds: number[];
}

export function NewsBoard() {
    const access = useAccess();
    const canWrite = access.has("news:write");
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<NewsPost | null>(null);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [publishedAt, setPublishedAt] = useState(localStamp());
    const [roleIds, setRoleIds] = useState<number[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    async function load() {
        setError(null);
        try {
            const response = await fetch("/api/news");
            const json = (await response.json()) as ApiResponse<NewsPost[]>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setPosts(json.data);
        } catch {
            setError("Не удалось загрузить новости");
        } finally {
            setLoaded(true);
        }
    }

    function begin(post: NewsPost | null) {
        setEditing(post);
        setTitle(post?.title ?? "");
        setBody(post?.body ?? "");
        setPublishedAt(post ? localStamp(post.publishedAt) : localStamp());
        setRoleIds(post?.roleIds ?? []);
        setError(null);
    }

    async function onSubmit(event: FormEvent) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(editing ? `/api/news/${editing.id}` : "/api/news", {
                method: editing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title, body, publishedAt: new Date(publishedAt).toISOString(), roleIds }),
            });
            const json = (await response.json()) as ApiResponse<NewsPost>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            notifySuccess(editing ? "Новость обновлена" : "Новость опубликована");
            begin(null);
            await load();
        } catch {
            setError("Не удалось сохранить новость");
        } finally {
            setSaving(false);
        }
    }

    async function remove(post: NewsPost) {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/api/news/${post.id}`, { method: "DELETE" });
            const json = (await response.json()) as ApiResponse<{ id: number }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            if (editing?.id === post.id) {
                begin(null);
            }
            await load();
        } catch {
            setError("Не удалось удалить новость");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {canWrite ? (
                <Card className="max-w-xl">
                    <CardHeader>
                        <CardTitle>{editing ? "Правка новости" : "Новая новость"}</CardTitle>
                        <CardDescription>Новость увидят только отмеченные роли.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" disabled={saving}>
                                    {saving ? <ButtonSpinner /> : null}
                                    {editing ? "Сохранить" : "Опубликовать"}
                                </Button>
                                {editing ? (
                                    <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => begin(null)}>
                                        Новая
                                    </Button>
                                ) : null}
                            </div>
                            <FormAlert message={error} />
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="news-title">Заголовок</Label>
                                <Input id="news-title" value={title} onChange={(event) => setTitle(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="news-body">Текст</Label>
                                <Textarea id="news-body" value={body} onChange={(event) => setBody(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="news-date">Дата</Label>
                                <Input id="news-date" type="datetime-local" value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Кто видит</Label>
                                <RoleChecks selected={roleIds} disabled={saving} onChange={setRoleIds} />
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : <FormAlert message={error} />}
            {!loaded ? <StackSkeleton /> : null}
            {loaded && posts.length === 0 ? (
                <Card><CardContent className="text-sm text-muted-foreground">Новостей пока нет.</CardContent></Card>
            ) : null}
            <div className="flex flex-col gap-3">
            {posts.map((post) => (
                <Card key={post.id}>
                    <CardHeader>
                        <CardTitle>{post.title}</CardTitle>
                        <CardDescription>
                            <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleString("ru-RU")}</time>
                            {` · ${post.author}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        <p className="whitespace-pre-wrap text-sm">{post.body}</p>
                        {canWrite ? (
                            <div className="flex gap-2">
                                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => begin(post)}>Изменить</Button>
                                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => void remove(post)}>Удалить</Button>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            ))}
            </div>
        </div>
    );
}

function localStamp(iso?: string): string {
    const date = iso ? new Date(iso) : new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
