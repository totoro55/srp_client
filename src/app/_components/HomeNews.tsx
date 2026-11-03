"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { CheckCheck, Mail, MailCheck, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { useHomeCardLimit } from "@/app/_components/home-card-limit";
import { NotificationIconButton } from "@/app/_components/notification-list";
import { newsAuthorLine } from "@/lib/news";
import { cn } from "@/lib/utils";
import { ApiResponse } from "@/types/api";

export interface HomeNewsItem {
    id: number;
    title: string;
    publishedAt: string;
    author: string;
    authorName: string | null;
    authorTitle: string | null;
    readAt: string | null;
}

export function HomeNews({ posts, canMark, canWrite }: { posts: HomeNewsItem[]; canMark: boolean; canWrite: boolean }) {
    const [items, setItems] = useState(posts);
    const [error, setError] = useState<string | null>(null);
    const [pendingId, setPendingId] = useState<number | null>(null);
    const [pendingAll, setPendingAll] = useState(false);
    const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const limit = useHomeCardLimit(listRef);
    const shown = homeNews(items, limit);
    const unread = items.filter((post) => post.readAt === null).length;

    async function markAllRead() {
        if (!canMark || unread === 0 || pendingAll || pendingId !== null) {
            return;
        }
        const previous = items;
        const readAt = new Date().toISOString();
        setPendingAll(true);
        setError(null);
        setItems((current) => current.map((item) => item.readAt === null ? { ...item, readAt } : item));
        try {
            const response = await fetch("/api/news", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true }),
            });
            const json = (await response.json()) as ApiResponse<{ read: boolean }>;
            if (!json.success) {
                setItems(previous);
                setError(json.error.message);
            }
        } catch {
            setItems(previous);
            setError("Не удалось отметить новости прочитанными");
        } finally {
            setPendingAll(false);
        }
    }

    async function setRead(post: HomeNewsItem, read: boolean) {
        if (!canMark || (post.readAt !== null) === read || pendingId !== null || pendingAll) {
            return;
        }
        const previous = post.readAt;
        setPendingId(post.id);
        setError(null);
        setItems((current) => current.map((item) => item.id === post.id ? { ...item, readAt: read ? new Date().toISOString() : null } : item));
        try {
            const response = await fetch(`/api/news/${post.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ read }),
            });
            const json = (await response.json()) as ApiResponse<{ id: number }>;
            if (!json.success) {
                setItems((current) => current.map((item) => item.id === post.id ? { ...item, readAt: previous } : item));
                setError(json.error.message);
            }
        } catch {
            setItems((current) => current.map((item) => item.id === post.id ? { ...item, readAt: previous } : item));
            setError(read ? "Не удалось отметить новость прочитанной" : "Не удалось отметить новость непрочитанной");
        } finally {
            setPendingId(null);
        }
    }

    return (
        <section className="flex h-full min-h-0 flex-col gap-2 sm:gap-3">
            <div className="flex min-h-6 items-center justify-between gap-3 sm:min-h-8">
                <h2 className="flex items-center gap-2 text-xs font-semibold sm:text-base">
                    Новости
                    {unread > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                            <span className="sr-only">Непрочитанных: </span>
                            <span className="inline-block leading-none">{unread > 9 ? "9+" : unread}</span>
                        </span>
                    ) : null}
                </h2>
                {canMark && unread > 0 ? (
                    <NotificationIconButton label="Отметить все прочитанными" disabled={pendingAll} onClick={() => void markAllRead()}>
                        {pendingAll ? <ButtonSpinner /> : <CheckCheck />}
                    </NotificationIconButton>
                ) : null}
            </div>
            <FormAlert message={error} />
            <Card className="min-h-0 flex-1 gap-0 py-0! lg:h-full">
                <CardContent className="flex h-full min-h-0 flex-col gap-1 px-2! pt-1.5 pb-0 sm:gap-2 sm:px-3! sm:pt-3">
                    <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                        {shown.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-muted-foreground sm:py-2 sm:text-sm">Новостей пока нет.</p>
                        ) : (
                            shown.map((post) => (
                                <HomeNewsRow
                                    key={post.id}
                                    post={post}
                                    canMark={canMark}
                                    pending={pendingId === post.id}
                                    revealed={openSwipeId === post.id}
                                    onReveal={setOpenSwipeId}
                                    onToggle={() => void setRead(post, post.readAt === null)}
                                />
                            ))
                        )}
                    </div>
                    {items.length > 0 || canWrite ? (
                        <div className="mt-auto flex h-8 shrink-0 items-center justify-between gap-2 border-t px-1 sm:h-12 sm:px-2">
                            {items.length > 0 ? (
                                <Link href="/news" className="text-xs text-muted-foreground hover:text-foreground sm:text-sm">
                                    Все новости
                                </Link>
                            ) : <span />}
                            {canWrite ? (
                                <Link
                                    href="/news/new"
                                    aria-label="Добавить новость"
                                    title="Добавить новость"
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

const SWIPE_ACTION = 44;
const SWIPE_COMMIT = 28;

function HomeNewsRow({
    post,
    canMark,
    pending,
    revealed,
    onReveal,
    onToggle,
}: {
    post: HomeNewsItem;
    canMark: boolean;
    pending: boolean;
    revealed: boolean;
    onReveal: (id: number | null) => void;
    onToggle: () => void;
}) {
    const unread = post.readAt === null;
    const label = unread ? "Отметить прочитанной" : "Отметить непрочитанной";
    const surface = unread
        ? "bg-[color-mix(in_oklab,var(--primary)_15%,var(--background))] hover:bg-[color-mix(in_oklab,var(--primary)_20%,var(--background))]"
        : "bg-background hover:bg-muted";
    const [dragX, setDragX] = useState<number | null>(null);
    const drag = useRef<{ pointerId: number; x: number; y: number; origin: number; swiping: boolean } | null>(null);
    const ignoreClick = useRef(false);
    const shown = canMark ? (dragX ?? (revealed ? -SWIPE_ACTION : 0)) : 0;
    const cornerFill = canMark && revealed && dragX === null;

    useEffect(() => {
        const media = window.matchMedia("(min-width: 640px)");
        function close() {
            if (!media.matches) {
                return;
            }
            setDragX(null);
            onReveal(null);
        }
        media.addEventListener("change", close);
        return () => media.removeEventListener("change", close);
    }, [onReveal]);

    function move(next: number) {
        setDragX(Math.max(-SWIPE_ACTION, Math.min(0, next)));
    }

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (!canMark || event.pointerType === "mouse" || pending) {
            return;
        }
        if (window.matchMedia("(min-width: 640px)").matches) {
            return;
        }
        if (!revealed) {
            onReveal(null);
        }
        drag.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            origin: revealed ? -SWIPE_ACTION : 0,
            swiping: false,
        };
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) {
            return;
        }
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.swiping) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
                drag.current = null;
                return;
            }
            if (Math.abs(dx) < 8) {
                return;
            }
            current.swiping = true;
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // The gesture can continue without capture if the pointer has already ended.
            }
        }
        move(current.origin + dx);
    }

    function endSwipe(event: ReactPointerEvent<HTMLDivElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) {
            return;
        }
        drag.current = null;
        if (!current.swiping) {
            setDragX(null);
            return;
        }
        const next = Math.max(-SWIPE_ACTION, Math.min(0, current.origin + (event.clientX - current.x)));
        ignoreClick.current = true;
        window.setTimeout(() => {
            ignoreClick.current = false;
        }, 400);
        setDragX(null);
        onReveal(next <= -SWIPE_COMMIT ? post.id : null);
    }

    return (
        <div data-home-row="" className="relative h-10 shrink-0 overflow-hidden rounded-xl sm:h-14 sm:rounded-md">
            {canMark ? (
                <div className="absolute inset-y-0 right-0 z-0 flex w-11 sm:hidden">
                    <button
                        type="button"
                        className="flex w-full items-center justify-center bg-primary text-primary-foreground disabled:opacity-60"
                        aria-label={label}
                        disabled={pending}
                        onClick={onToggle}
                    >
                        {pending ? <ButtonSpinner /> : unread ? <MailCheck className="size-4" /> : <Mail className="size-4" />}
                    </button>
                </div>
            ) : null}
            <div
                className={cn("relative z-10 h-full touch-pan-y", surface, dragX === null && "transition-transform")}
                style={shown === 0 ? undefined : { transform: `translateX(${shown}px)` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endSwipe}
                onPointerCancel={endSwipe}
            >
                {cornerFill ? (
                    <>
                        <span className="absolute top-0 right-0 z-0 size-[14px] bg-primary sm:hidden" aria-hidden />
                        <span className="absolute bottom-0 right-0 z-0 size-[14px] bg-primary sm:hidden" aria-hidden />
                    </>
                ) : null}
                <div className={cn("relative z-10 flex h-full items-center rounded-xl transition-colors sm:rounded-md", surface, unread && "border-l-2 border-primary")}>
                    <Link
                        href={`/news/${post.id}`}
                        className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-xl px-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:rounded-md sm:px-2"
                        onClick={(event) => {
                            if (ignoreClick.current || revealed) {
                                event.preventDefault();
                                ignoreClick.current = false;
                                if (revealed) {
                                    onReveal(null);
                                }
                            }
                        }}
                    >
                        <span className="min-w-0 flex-1">
                            <span className={cn("block truncate text-[11px] leading-4 text-foreground sm:text-sm", unread && "font-medium")}>
                                {unread ? <span className="sr-only">Непрочитанная. </span> : null}
                                {post.title}
                            </span>
                            <span className="block truncate text-[10px] leading-3 text-muted-foreground sm:mt-0.5 sm:text-xs sm:leading-4">
                                {new Date(post.publishedAt).toLocaleString("ru-RU")}
                                {` · ${newsAuthorLine(post)}`}
                            </span>
                        </span>
                    </Link>
                    {canMark ? (
                        <span className="hidden sm:inline-flex">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="mr-1 shrink-0 text-muted-foreground"
                                aria-label={label}
                                title={label}
                                disabled={pending}
                                onClick={onToggle}
                            >
                                {pending ? <ButtonSpinner /> : unread ? <MailCheck /> : <Mail />}
                            </Button>
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function homeNews<T extends { readAt: string | null }>(posts: T[], limit: number): T[] {
    const unread = posts.filter((post) => post.readAt === null);
    const read = posts.filter((post) => post.readAt !== null);
    return [...unread, ...read].slice(0, limit);
}
