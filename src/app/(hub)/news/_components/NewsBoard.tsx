"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { useAccess } from "@/hooks/useAccess";
import { cn } from "@/lib/utils";
import { notifySuccess } from "@/lib/notify";
import { newsAuthorLine } from "@/lib/news";
import { ApiResponse } from "@/types/api";

interface NewsPost {
    id: number;
    title: string;
    body: string;
    status: "draft" | "published";
    publishedAt: string;
    author: string;
    authorName: string | null;
    authorTitle: string | null;
}

export function NewsBoard() {
    const access = useAccess();
    const canWrite = access.has("news:write");
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");

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

    async function remove(post: NewsPost) {
        setDeletingId(post.id);
        setError(null);
        try {
            const response = await fetch(`/api/news/${post.id}`, { method: "DELETE" });
            const json = (await response.json()) as ApiResponse<{ id: number }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            notifySuccess("Новость удалена");
            await load();
        } catch {
            setError("Не удалось удалить новость");
        } finally {
            setDeletingId(null);
        }
    }

    const rangeInvalid = from !== "" && to !== "" && from > to;
    const visiblePosts = useMemo(() => posts.filter((post) => {
        if (rangeInvalid) return false;
        const day = dayKey(post.publishedAt);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
    }), [from, posts, rangeInvalid, to]);
    const groups = useMemo(() => groupByDay(visiblePosts), [visiblePosts]);
    const filtered = from !== "" || to !== "";

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
                {canWrite ? <Link href="/news/new" className={buttonVariants({ size: "sm" })}>Добавить новость</Link> : null}
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="news-from">С</Label>
                    <Input id="news-from" type="date" className="w-40" value={from} onChange={(event) => setFrom(event.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor="news-to">По</Label>
                    <Input id="news-to" type="date" className="w-40" value={to} onChange={(event) => setTo(event.target.value)} />
                </div>
                {filtered ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Сбросить</Button>
                ) : null}
            </div>
            <FormAlert message={error} />
            {!loaded ? <StackSkeleton /> : null}
            {loaded && posts.length === 0 ? (
                <Card><CardContent className="text-sm text-muted-foreground">Новостей пока нет.</CardContent></Card>
            ) : null}
            {loaded && posts.length > 0 && rangeInvalid ? (
                <Card><CardContent className="text-sm text-muted-foreground">Дата начала позже даты окончания.</CardContent></Card>
            ) : null}
            {loaded && posts.length > 0 && !rangeInvalid && groups.length === 0 ? (
                <Card><CardContent className="text-sm text-muted-foreground">За выбранные даты новостей нет.</CardContent></Card>
            ) : null}
            {groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-3">
                    <h2 className="text-sm font-medium text-muted-foreground">{group.label}</h2>
                    {group.posts.map((post) => {
                        const scheduled = post.status === "published" && new Date(post.publishedAt).getTime() > Date.now();
                        const deleting = deletingId === post.id;
                        return (
                            <Card key={post.id}>
                                <CardHeader>
                                    <CardTitle className="wrap-break-word">
                                        <Link href={`/news/${post.id}`} className="hover:underline">{post.title}</Link>
                                    </CardTitle>
                                    <CardDescription>
                                        <time dateTime={post.publishedAt}>{new Date(post.publishedAt).toLocaleString("ru-RU")}</time>
                                        {post.status === "draft" ? " · Черновик" : ""}
                                        {scheduled ? " · Отложена" : ""}
                                        {` · ${newsAuthorLine(post)}`}
                                    </CardDescription>
                                    {canWrite ? (
                                        <CardAction className="flex">
                                            <Link
                                                href={`/news/${post.id}/edit`}
                                                aria-label={`Изменить новость ${post.title}`}
                                                aria-disabled={deleting}
                                                className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground", deleting && "pointer-events-none opacity-50")}
                                            >
                                                <Pencil />
                                            </Link>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-muted-foreground hover:text-destructive"
                                                aria-label={`Удалить новость ${post.title}`}
                                                disabled={deleting}
                                                onClick={() => void remove(post)}
                                            >
                                                {deleting ? <ButtonSpinner /> : <Trash2 />}
                                            </Button>
                                        </CardAction>
                                    ) : null}
                                </CardHeader>
                                <CardContent>
                                    <NewsExcerpt text={post.body} />
                                </CardContent>
                            </Card>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}

function NewsExcerpt({ text }: { text: string }) {
    const ref = useRef<HTMLParagraphElement>(null);
    const [open, setOpen] = useState(false);
    const [overflows, setOverflows] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node || open) return;
        setOverflows(node.scrollHeight > node.clientHeight + 1);
    }, [open, text]);

    if (text.length === 0) {
        return null;
    }

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <p
                ref={ref}
                className={open
                    ? "text-sm wrap-break-word whitespace-pre-wrap"
                    : "line-clamp-4 text-sm wrap-break-word whitespace-pre-wrap"}
            >
                {text}
            </p>
            {overflows || open ? (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto self-start px-0"
                    onClick={() => setOpen((value) => !value)}
                >
                    {open ? "Свернуть" : "Показать полностью"}
                </Button>
            ) : null}
        </div>
    );
}

function dayKey(iso: string): string {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function groupByDay(posts: NewsPost[]): { key: string; label: string; posts: NewsPost[] }[] {
    const groups: { key: string; label: string; posts: NewsPost[] }[] = [];
    for (const post of posts) {
        const date = new Date(post.publishedAt);
        const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const last = groups[groups.length - 1];
        if (last?.key === key) {
            last.posts.push(post);
            continue;
        }
        groups.push({
            key,
            label: date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
            posts: [post],
        });
    }
    return groups;
}
