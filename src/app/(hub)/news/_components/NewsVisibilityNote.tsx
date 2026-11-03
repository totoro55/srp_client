"use client";

import { useState } from "react";
import { Clock, Info } from "lucide-react";
import type { NewsStatus } from "@/lib/news";

export function NewsVisibilityNote({ status, publishedAt }: { status: NewsStatus; publishedAt: string }) {
    const [now] = useState(() => Date.now());
    const when = new Date(publishedAt);
    const scheduled = status === "published" && !Number.isNaN(when.getTime()) && when.getTime() > now;
    if (status === "draft") {
        return (
            <p role="note" className="flex w-full items-start gap-2 rounded-md border border-sky-600/40 bg-sky-500/15 px-3 py-2 text-sm font-medium text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-50">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Новость не видна пользователям, пока не опубликована.
            </p>
        );
    }
    if (!scheduled) {
        return null;
    }
    const stamp = when.toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
    return (
        <p role="note" className="flex w-full items-start gap-2 rounded-md border border-amber-600/50 bg-amber-500/20 px-3 py-2 text-sm font-medium text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-50">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            Новость пока не видна пользователям. Она будет опубликована автоматически после {stamp}.
        </p>
    );
}
