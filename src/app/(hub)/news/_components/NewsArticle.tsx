"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NewsNode } from "@/lib/news-document";
import type { NewsStatus } from "@/lib/news";
import { NewsEditor } from "./NewsEditor";

export function NewsArticle({
    title,
    publishedAt,
    authorLine,
    status,
    content,
    plain,
    editHref,
    assetsUrl,
    placeholder,
    anchorLinks,
    anchorPage,
}: {
    title: string;
    publishedAt: string;
    authorLine: string;
    status: NewsStatus;
    content: NewsNode | null;
    plain: string;
    editHref?: string | null;
    assetsUrl?: string;
    placeholder?: string;
    anchorLinks?: boolean;
    anchorPage?: string;
}) {
    const scheduled = status === "published" && new Date(publishedAt).getTime() > Date.now();

    return (
        <Card>
            <CardHeader>
                <CardTitle className="wrap-break-word">{title}</CardTitle>
                <CardDescription>
                    <time dateTime={publishedAt}>{new Date(publishedAt).toLocaleString("ru-RU")}</time>
                    {status === "draft" ? " · Черновик" : ""}
                    {scheduled ? " · Отложена" : ""}
                    {authorLine ? ` · ${authorLine}` : ""}
                </CardDescription>
                {editHref ? (
                    <CardAction>
                        <Link
                            href={editHref}
                            aria-label={`Изменить новость ${title}`}
                            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                        >
                            <Pencil />
                        </Link>
                    </CardAction>
                ) : null}
            </CardHeader>
            <CardContent>
                {content ? (
                    <NewsEditor
                        content={content}
                        loadKey="article"
                        editable={false}
                        assetsUrl={assetsUrl}
                        placeholder={placeholder}
                        anchorLinks={anchorLinks}
                        anchorPage={anchorPage}
                    />
                ) : <p className="text-sm wrap-break-word whitespace-pre-wrap">{plain}</p>}
            </CardContent>
        </Card>
    );
}
