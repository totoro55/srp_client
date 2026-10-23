"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormAlert } from "@/components/form-alert";
import { Input } from "@/components/ui/input";
import { StackSkeleton } from "@/components/loading-state";
import { useAccess } from "@/hooks/useAccess";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";
import { WikiEditor, WikiToc } from "./WikiEditor";
import type { WikiHeading, WikiNode } from "@/lib/wiki-document";

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
}

interface WikiArticle extends WikiArticleSummary {
    document: WikiNode;
    headings: WikiHeading[];
    hint: string;
    sources: string;
    formula: string;
    rules: string;
}

export function WikiDesk() {
    const params = useParams<{ id?: string }>();
    const access = useAccess();
    const canWrite = access.has("wiki:write");
    const [groups, setGroups] = useState<WikiGroup[]>([]);
    const [articles, setArticles] = useState<WikiArticleSummary[]>([]);
    const [article, setArticle] = useState<WikiArticle | null>(null);
    const [query, setQuery] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const articleId = params.id && /^\d+$/.test(params.id) ? Number(params.id) : null;

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load(query);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (articleId === null) {
            return;
        }
        const timer = window.setTimeout(() => {
            void openArticle(articleId);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [articleId]);

    async function load(search: string) {
        setError(null);
        try {
            const response = await fetch(`/api/wiki?q=${encodeURIComponent(search)}`);
            const json = (await response.json()) as ApiResponse<{ groups: WikiGroup[]; articles: WikiArticleSummary[] }>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setGroups(json.data.groups);
            setArticles(json.data.articles);
        } catch {
            setError("Не удалось загрузить базу знаний");
        } finally {
            setLoaded(true);
        }
    }

    async function openArticle(id: number) {
        const response = await fetch(`/api/wiki/articles/${id}`);
        const json = (await response.json()) as ApiResponse<WikiArticle>;
        if (!json.success) {
            setError(json.error.message);
            setArticle(null);
            return;
        }
        setArticle(json.data);
    }

    const roots = groups.filter((group) => group.parentId === null);

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <Card>
                <CardContent className="flex flex-col gap-3">
                    <Input value={query} placeholder="Найти в статьях" aria-label="Найти в статьях" onChange={(event) => setQuery(event.target.value)} />
                    {canWrite ? (
                        <div className="flex flex-col gap-2">
                            <Link href="/wiki/new" className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Новая статья</Link>
                            <GroupCreator onCreated={() => void load(query)} />
                        </div>
                    ) : null}
                    {!loaded ? <StackSkeleton rows={6} /> : null}
                    {loaded && articles.length === 0 && groups.length === 0 ? <p className="text-sm text-muted-foreground">Статей пока нет.</p> : null}
                    <ul className="flex flex-col gap-3 text-sm">
                        {roots.map((group) => (
                            <GroupBranch key={group.id} group={group} groups={groups} articles={articles} activeId={articleId} />
                        ))}
                    </ul>
                </CardContent>
            </Card>
            <div className="flex min-w-0 flex-col gap-3">
                <FormAlert message={error} />
                {article ? (
                    <Card>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <h2 className="text-lg font-semibold">{article.title}</h2>
                                {canWrite ? (
                                    <Link href={`/wiki/${article.id}/edit`} className={cn(buttonVariants({ size: "sm", variant: "outline" }))}>Править</Link>
                                ) : null}
                            </div>
                            <WikiFields article={article} />
                            <WikiToc headings={article.headings} />
                            <WikiEditor document={article.document} editable={false} />
                        </CardContent>
                    </Card>
                ) : loaded ? (
                    <Card>
                        <CardContent className="text-sm text-muted-foreground">Выберите статью слева или найдите её по тексту.</CardContent>
                    </Card>
                ) : null}
            </div>
        </div>
    );
}

function GroupBranch({
    group,
    groups,
    articles,
    activeId,
}: {
    group: WikiGroup;
    groups: WikiGroup[];
    articles: WikiArticleSummary[];
    activeId: number | null;
}) {
    const children = groups.filter((item) => item.parentId === group.id);
    const own = articles.filter((article) => article.groupId === group.id);
    return (
        <li className="flex flex-col gap-1">
            <p className="px-2 text-xs font-medium text-muted-foreground">{group.title}</p>
            <ul className="flex flex-col gap-0.5">
                {own.map((article) => (
                    <li key={article.id}>
                        <Link
                            href={`/wiki/${article.id}`}
                            className={cn(
                                "block rounded-md px-2 py-1.5 hover:bg-muted",
                                article.id === activeId && "bg-muted font-medium",
                            )}
                        >
                            {article.title}
                        </Link>
                    </li>
                ))}
                {children.map((child) => (
                    <GroupBranch key={child.id} group={child} groups={groups} articles={articles} activeId={activeId} />
                ))}
            </ul>
        </li>
    );
}

function WikiFields({ article }: { article: WikiArticle }) {
    const fields = [
        ["Подсказка", article.hint],
        ["Источники", article.sources],
        ["Формула", article.formula],
        ["Правила", article.rules],
    ].filter(([, value]) => value);
    if (fields.length === 0) {
        return null;
    }
    return (
        <dl className="grid gap-3 rounded-lg bg-muted/40 p-3 text-sm">
            {fields.map(([label, value]) => (
                <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function GroupCreator({ onCreated }: { onCreated: () => void }) {
    const [title, setTitle] = useState("");
    const [saving, setSaving] = useState(false);

    async function create() {
        setSaving(true);
        const rolesResponse = await fetch("/api/content/roles");
        const rolesJson = (await rolesResponse.json()) as ApiResponse<{ id: number; name: string }[]>;
        if (!rolesJson.success) {
            setSaving(false);
            return;
        }
        const response = await fetch("/api/wiki/groups", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, parentId: null, roleIds: rolesJson.data.map((role) => role.id) }),
        });
        setSaving(false);
        const json = (await response.json()) as ApiResponse<unknown>;
        if (!json.success) {
            return;
        }
        setTitle("");
        onCreated();
    }

    return (
        <div className="flex gap-1">
            <Input value={title} placeholder="Новая группа" aria-label="Новая группа" onChange={(event) => setTitle(event.target.value)} />
            <Button type="button" size="sm" variant="outline" disabled={saving || title.trim() === ""} onClick={() => void create()}>Ок</Button>
        </div>
    );
}
