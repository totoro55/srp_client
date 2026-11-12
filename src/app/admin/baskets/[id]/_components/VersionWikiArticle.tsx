"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { LookupSkeleton } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BasketVersionArticle } from "@/lib/baskets";
import type { ApiResponse } from "@/types/api";

interface ArticleHit {
    kind: string;
    id: number;
    title: string;
    path: string;
    status: string | null;
    archived: boolean;
}

export function VersionWikiArticle({
    article,
    disabled,
    onChange,
}: {
    article: BasketVersionArticle | null;
    disabled: boolean;
    onChange: (article: BasketVersionArticle | null) => void;
}) {
    const [query, setQuery] = useState("");
    const [hits, setHits] = useState<ArticleHit[] | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const needle = query.trim();

    useEffect(() => {
        if (needle.length === 0) {
            return;
        }
        let stopped = false;
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams({ q: needle, mode: "articles", fields: "title" });
            setPending(true);
            setError(null);
            void fetch(`/api/wiki/search?${params}`)
                .then(async (response) => {
                    const json = (await response.json()) as ApiResponse<ArticleHit[]>;
                    if (stopped) {
                        return;
                    }
                    if (!json.success) {
                        setHits(null);
                        setError(json.error.message);
                        return;
                    }
                    setHits(json.data.filter((hit) => hit.kind === "article" && !hit.archived));
                })
                .catch(() => {
                    if (!stopped) {
                        setHits(null);
                        setError("Не удалось найти статьи");
                    }
                })
                .finally(() => {
                    if (!stopped) {
                        setPending(false);
                    }
                });
        }, 300);
        return () => {
            stopped = true;
            window.clearTimeout(timer);
        };
    }, [needle]);

    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor="version-wiki">Статья базы знаний</Label>
            {article ? (
                <div className="flex min-w-0 items-center gap-1">
                    <Link href={`/wiki/${article.id}`} target="_blank" className="min-w-0 truncate text-sm underline">
                        {article.title}
                    </Link>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Убрать статью" disabled={disabled} onClick={() => onChange(null)}>
                        <X />
                    </Button>
                </div>
            ) : null}
            <Input
                id="version-wiki"
                value={query}
                disabled={disabled}
                placeholder="Найти статью"
                onChange={(event) => {
                    setQuery(event.target.value);
                    if (event.target.value.trim() === "") {
                        setHits(null);
                        setError(null);
                        setPending(false);
                    }
                }}
            />
            {pending ? <LookupSkeleton rows={3} lines={1} /> : null}
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {!pending && hits && hits.length === 0 ? (
                <p className="text-xs text-muted-foreground">Статей не найдено.</p>
            ) : null}
            {!pending && hits && hits.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto rounded-md border">
                    {hits.map((hit) => (
                        <li key={hit.id} className="border-b last:border-b-0">
                            <button
                                type="button"
                                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-muted"
                                onClick={() => {
                                    onChange({ id: hit.id, title: hit.title });
                                    setQuery("");
                                    setHits(null);
                                }}
                            >
                                <span className="text-sm">{hit.title}</span>
                                <span className="text-xs text-muted-foreground">
                                    {hit.status === "published" ? hit.path : "Черновик. Кнопка в тарифах появится после публикации."}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            <p className="text-xs text-muted-foreground">Кнопка «Описание» на странице тарифов открывает эту статью, когда она опубликована.</p>
        </div>
    );
}
