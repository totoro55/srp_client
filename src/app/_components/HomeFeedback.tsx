"use client";

import { useRef } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHomeCardLimit } from "@/app/_components/home-card-limit";
import { FeedbackCountBadges } from "@/components/feedback-counts";
import { FeedbackStatusBadge } from "@/components/feedback-status-badge";
import { cn } from "@/lib/utils";
import type { FeedbackCounts, HomeFeedbackItem } from "@/services/feedback";

export function HomeFeedback({
    items,
    counts,
    canWrite,
    processor,
}: {
    items: HomeFeedbackItem[];
    counts: FeedbackCounts;
    canWrite: boolean;
    processor: boolean;
}) {
    const listRef = useRef<HTMLDivElement>(null);
    const limit = useHomeCardLimit(listRef);
    const shown = items.slice(0, limit);
    return (
        <section className="flex h-full min-h-0 flex-col gap-2 sm:gap-3">
            <div className="flex min-h-6 items-center sm:min-h-8">
                <h2 className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold sm:text-base">
                    Обратная связь
                    <FeedbackCountBadges counts={counts} processor={processor} size="icon" home />
                </h2>
            </div>
            <Card className="min-h-0 flex-1 gap-0 py-0! lg:h-full">
                <CardContent className="flex h-full min-h-0 flex-col gap-1 px-2! pt-1.5 pb-0 sm:gap-2 sm:px-3! sm:pt-3">
                    <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                        {shown.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-muted-foreground sm:py-2 sm:text-sm">
                                Нет новых обращений и непрочитанных ответов.
                            </p>
                        ) : (
                            shown.map((ticket) => (
                                <Link
                                    key={ticket.id}
                                    href={`/feedback/${ticket.id}`}
                                    data-home-row=""
                                    className={cn(
                                        "flex h-10 shrink-0 items-center rounded-lg px-1.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-14 sm:rounded-md sm:px-2",
                                        ticket.unread
                                            ? "border-l-2 border-primary bg-[color-mix(in_oklab,var(--primary)_15%,var(--background))] hover:bg-[color-mix(in_oklab,var(--primary)_20%,var(--background))]"
                                            : "hover:bg-muted",
                                    )}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-start justify-between gap-2">
                                            <span className={cn("min-w-0 truncate text-[11px] leading-4 text-foreground sm:text-sm", ticket.unread && "font-medium")}>
                                                {ticket.unread ? <span className="sr-only">Есть непрочитанный ответ. </span> : null}
                                                <span className="text-muted-foreground">№{ticket.id}</span>
                                                {` ${ticket.subject}`}
                                            </span>
                                            <FeedbackStatusBadge status={ticket.status} />
                                        </span>
                                        <span className="block truncate text-[10px] leading-3 text-muted-foreground sm:mt-0.5 sm:text-xs sm:leading-4">
                                            {processor && ticket.authorName ? `${ticket.authorName} · ` : ""}
                                            {new Date(ticket.updatedAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </span>
                                </Link>
                            ))
                        )}
                    </div>
                    {items.length > 0 || canWrite ? (
                        <div className="mt-auto flex h-8 shrink-0 items-center justify-between gap-2 border-t px-1 sm:h-12 sm:px-2">
                            {items.length > 0 ? (
                                <Link href="/feedback" className="text-xs text-muted-foreground hover:text-foreground sm:text-sm">
                                    Все обращения
                                </Link>
                            ) : <span />}
                            {canWrite ? (
                                <Link
                                    href="/feedback"
                                    aria-label="Создать обращение"
                                    title="Создать обращение"
                                    className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "ml-auto shrink-0 text-muted-foreground")}
                                >
                                    <Plus />
                                </Link>
                            ) : null}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </section>
    );
}
