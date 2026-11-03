"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarClock, CalendarIcon, Check, ChevronRight, ListFilter, Mail, MailCheck, Mails, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import type { DateGroupPrecision } from "@/lib/date-groups";
import type { DateRange } from "react-day-picker";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form-alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { useAccess } from "@/hooks/useAccess";
import { formatGroupedWhen, groupByDate } from "@/lib/date-groups";
import { cn } from "@/lib/utils";
import { notifySuccess } from "@/lib/notify";
import { newsAuthorLine, newsIsLive } from "@/lib/news";
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
    readAt: string | null;
}

type NewsStatusFilter = "all" | "published" | "draft" | "scheduled";
type NewsReadFilter = "all" | "unread";

const STATUS_FILTERS: { value: NewsStatusFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "published", label: "Опубликованные" },
    { value: "draft", label: "Черновики" },
    { value: "scheduled", label: "Отложенные" },
];

const READ_FILTERS: { value: NewsReadFilter; label: string }[] = [
    { value: "all", label: "Все" },
    { value: "unread", label: "Непрочитанные" },
];

export function NewsBoard() {
    const access = useAccess();
    const canWrite = access.has("news:write");
    const canMark = Boolean(access.roleCode) && !access.conflict && !access.previewRoleName;
    const [posts, setPosts] = useState<NewsPost[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [pendingDelete, setPendingDelete] = useState<NewsPost | null>(null);
    const [pendingSchedule, setPendingSchedule] = useState<NewsPost | null>(null);
    const [scheduleAt, setScheduleAt] = useState("");
    const [scheduleError, setScheduleError] = useState<string | null>(null);
    const [scheduling, setScheduling] = useState(false);
    const [period, setPeriod] = useState<DateRange | undefined>();
    const [periodOpen, setPeriodOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<NewsStatusFilter>("all");
    const [readFilter, setReadFilter] = useState<NewsReadFilter>("all");
    const [markingId, setMarkingId] = useState<number | null>(null);
    const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);

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

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    function askDelete(post: NewsPost) {
        setOpenSwipeId(null);
        setPendingDelete(post);
    }

    function askSchedule(post: NewsPost) {
        setOpenSwipeId(null);
        setScheduleError(null);
        setScheduleAt(localStamp(post.publishedAt));
        setPendingSchedule(post);
    }

    async function saveSchedule() {
        if (!pendingSchedule || scheduling) {
            return;
        }
        if (!scheduleAt || Number.isNaN(new Date(scheduleAt).getTime())) {
            setScheduleError("Укажите дату публикации");
            return;
        }
        setScheduling(true);
        setScheduleError(null);
        try {
            const response = await fetch(`/api/news/${pendingSchedule.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ publishedAt: new Date(scheduleAt).toISOString() }),
            });
            const json = (await response.json()) as ApiResponse<NewsPost>;
            if (!json.success) {
                setScheduleError(json.error.message);
                return;
            }
            notifySuccess("Время публикации изменено");
            setPendingSchedule(null);
            await load();
        } catch {
            setScheduleError("Не удалось изменить время публикации");
        } finally {
            setScheduling(false);
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
            setPendingDelete(null);
        }
    }

    async function setRead(post: NewsPost, read: boolean) {
        if (!canMark || (post.readAt !== null) === read || markingId !== null) {
            return;
        }
        const previous = post.readAt;
        setMarkingId(post.id);
        setOpenSwipeId(null);
        setPosts((items) => items.map((item) => item.id === post.id ? { ...item, readAt: read ? new Date().toISOString() : null } : item));
        try {
            const response = await fetch(`/api/news/${post.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ read }),
            });
            const json = (await response.json()) as ApiResponse<{ id: number }>;
            if (!json.success) {
                setPosts((items) => items.map((item) => item.id === post.id ? { ...item, readAt: previous } : item));
                setError(json.error.message);
            }
        } catch {
            setPosts((items) => items.map((item) => item.id === post.id ? { ...item, readAt: previous } : item));
            setError(read ? "Не удалось отметить новость прочитанной" : "Не удалось отметить новость непрочитанной");
        } finally {
            setMarkingId(null);
        }
    }

    const from = period?.from ? dayKeyFromDate(period.from) : "";
    const to = period?.to ? dayKeyFromDate(period.to) : "";
    const activeStatus = canWrite ? statusFilter : "all";
    const visiblePosts = useMemo(() => posts.filter((post) => {
        if (!matchesStatus(post, activeStatus)) return false;
        if (readFilter === "unread" && !isUnread(post)) return false;
        const day = dayKey(post.publishedAt);
        if (from && day < from) return false;
        if (to && day > to) return false;
        return true;
    }), [activeStatus, from, posts, readFilter, to]);
    const groups = useMemo(() => groupByDate(visiblePosts, (post) => post.publishedAt), [visiblePosts]);
    const periodFiltered = Boolean(period?.from || period?.to);
    const statusFiltered = canWrite && statusFilter !== "all";
    const readFiltered = readFilter !== "all";
    const filtered = periodFiltered || statusFiltered || readFiltered;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                    <PopoverTrigger
                        render={(
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "min-w-0 flex-1 justify-start overflow-hidden font-normal sm:max-w-72 sm:flex-none",
                                    !periodFiltered && "text-muted-foreground",
                                )}
                                aria-label="Период новостей"
                            />
                        )}
                    >
                        <CalendarIcon className="shrink-0" />
                        <span className="truncate">{periodLabel(period)}</span>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto gap-0 p-0">
                        <Calendar
                            mode="range"
                            locale={ru}
                            numberOfMonths={2}
                            defaultMonth={period?.from}
                            selected={period}
                            onSelect={(next) => {
                                setPeriod(next);
                                if (next?.from && next.to) {
                                    setPeriodOpen(false);
                                }
                            }}
                        />
                    </PopoverContent>
                </Popover>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={(
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn("shrink-0 font-normal max-sm:size-8 max-sm:px-0", !readFiltered && "text-muted-foreground")}
                                aria-label="Прочтение новостей"
                            />
                        )}
                    >
                        <Mails />
                        <span className="max-sm:hidden">
                            {READ_FILTERS.find((item) => item.value === readFilter)?.label ?? "Все"}
                        </span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-44">
                        {READ_FILTERS.map((item) => (
                            <DropdownMenuItem key={item.value} onClick={() => setReadFilter(item.value)}>
                                <Check className={item.value === readFilter ? undefined : "invisible"} />
                                {item.label}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                {canWrite ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={(
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className={cn("shrink-0 font-normal max-sm:size-8 max-sm:px-0", !statusFiltered && "text-muted-foreground")}
                                    aria-label="Статус новостей"
                                />
                            )}
                        >
                            <ListFilter />
                            <span className="max-sm:hidden">
                                {STATUS_FILTERS.find((item) => item.value === statusFilter)?.label ?? "Все"}
                            </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-44">
                            {STATUS_FILTERS.map((item) => (
                                <DropdownMenuItem key={item.value} onClick={() => setStatusFilter(item.value)}>
                                    <Check className={item.value === statusFilter ? undefined : "invisible"} />
                                    {item.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : null}
                {filtered ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="shrink-0"
                        aria-label="Сбросить фильтры"
                        onClick={() => {
                            setPeriod(undefined);
                            setStatusFilter("all");
                            setReadFilter("all");
                        }}
                    >
                        <X />
                    </Button>
                ) : null}
                {canWrite ? (
                    <Link
                        href="/news/new"
                        aria-label="Добавить новость"
                        className={cn(buttonVariants({ size: "sm" }), "ml-auto shrink-0 max-sm:size-8 max-sm:px-0")}
                    >
                        <Plus className="sm:hidden" />
                        <span className="max-sm:hidden">Добавить новость</span>
                    </Link>
                ) : null}
            </div>
            <Dialog open={pendingSchedule !== null} onOpenChange={(open) => { if (!scheduling && !open) setPendingSchedule(null); }}>
                <DialogContent>
                    <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void saveSchedule(); }}>
                        <DialogHeader>
                            <DialogTitle>Время публикации</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="schedule-date">Дата и время</Label>
                            <Input id="schedule-date" type="datetime-local" value={scheduleAt} autoFocus onChange={(event) => setScheduleAt(event.target.value)} />
                        </div>
                        {scheduleError ? <FormAlert message={scheduleError} /> : null}
                        <DialogFooter>
                            <Button type="button" variant="outline" disabled={scheduling} onClick={() => setPendingSchedule(null)}>Отмена</Button>
                            <Button type="submit" disabled={scheduling}>
                                {scheduling ? <ButtonSpinner /> : null}
                                Сохранить
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <ConfirmDialog
                open={pendingDelete !== null}
                title="Удалить новость"
                description={pendingDelete ? `«${pendingDelete.title}» будет удалена без возможности восстановления.` : ""}
                confirmLabel="Удалить"
                isPending={deletingId !== null}
                onConfirm={() => {
                    if (pendingDelete) {
                        void remove(pendingDelete);
                    }
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingDelete(null);
                    }
                }}
            />
            <FormAlert message={error} />
            {!loaded ? <StackSkeleton /> : null}
            {loaded && posts.length === 0 ? (
                <Card><CardContent className="text-sm text-muted-foreground">Новостей пока нет.</CardContent></Card>
            ) : null}
            {loaded && posts.length > 0 && groups.length === 0 ? (
                <Card><CardContent className="text-sm text-muted-foreground">По выбранным фильтрам новостей нет.</CardContent></Card>
            ) : null}
            {groups.map((group) => (
                <section key={group.key} className="flex flex-col gap-2">
                    <h2 className="text-xs font-medium text-muted-foreground" suppressHydrationWarning>{group.label}</h2>
                    {group.items.map((post) => (
                        <NewsCard
                            key={post.id}
                            post={post}
                            precision={group.precision}
                            canWrite={canWrite}
                            canMark={canMark}
                            deleting={deletingId === post.id}
                            marking={markingId === post.id}
                            revealed={openSwipeId === post.id}
                            onReveal={setOpenSwipeId}
                            onDelete={() => askDelete(post)}
                            onSchedule={() => askSchedule(post)}
                            onToggleRead={() => void setRead(post, post.readAt === null)}
                        />
                    ))}
                </section>
            ))}
        </div>
    );
}

const SWIPE_ACTION = 44;
const SWIPE_COMMIT = 28;

function NewsCard({
    post,
    precision,
    canWrite,
    canMark,
    deleting,
    marking,
    revealed,
    onReveal,
    onDelete,
    onSchedule,
    onToggleRead,
}: {
    post: NewsPost;
    precision: DateGroupPrecision;
    canWrite: boolean;
    canMark: boolean;
    deleting: boolean;
    marking: boolean;
    revealed: boolean;
    onReveal: (id: number | null) => void;
    onDelete: () => void;
    onSchedule: () => void;
    onToggleRead: () => void;
}) {
    const scheduled = isScheduled(post);
    const draft = post.status === "draft";
    const live = newsIsLive(post);
    const unread = live && post.readAt === null;
    const showRead = live && canMark;
    const href = `/news/${post.id}`;
    const previewHref = `/news/${post.id}/edit?preview=1`;
    const actionCount = (showRead ? 1 : 0) + (canWrite && draft ? 1 : 0) + (canWrite && scheduled ? 1 : 0) + (canWrite ? 2 : 0);
    const corner = showRead ? "bg-primary" : canWrite && draft ? "bg-foreground" : canWrite && scheduled ? "bg-amber-600" : "bg-muted";
    const actionWidth = actionCount * SWIPE_ACTION;
    const [dragX, setDragX] = useState<number | null>(null);
    const drag = useRef<{ pointerId: number; x: number; y: number; origin: number; swiping: boolean } | null>(null);
    const ignoreClick = useRef(false);
    const shown = dragX ?? (revealed ? -actionWidth : 0);
    const surface = unread ? "bg-[color-mix(in_oklab,var(--primary)_5%,var(--card))]" : "bg-card";
    const cornerFill = revealed && dragX === null;

    function move(next: number) {
        setDragX(Math.max(-actionWidth, Math.min(0, next)));
    }

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.pointerType === "mouse" || actionWidth === 0 || deleting || marking) {
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
            origin: revealed ? -actionWidth : 0,
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
        const next = Math.max(-actionWidth, Math.min(0, current.origin + (event.clientX - current.x)));
        ignoreClick.current = true;
        window.setTimeout(() => {
            ignoreClick.current = false;
        }, 400);
        setDragX(null);
        onReveal(next <= -SWIPE_COMMIT ? post.id : null);
    }

    return (
        <div className="relative overflow-hidden rounded-xl">
            {actionWidth > 0 ? (
                <div className="absolute inset-y-0 right-0 z-0 flex sm:hidden" style={{ width: actionWidth }}>
                    {showRead ? (
                        <button
                            type="button"
                            className="flex shrink-0 items-center justify-center bg-primary text-primary-foreground disabled:opacity-60"
                            style={{ width: SWIPE_ACTION }}
                            aria-label={unread ? "Отметить прочитанной" : "Отметить непрочитанной"}
                            disabled={marking}
                            onClick={onToggleRead}
                        >
                            {marking ? <ButtonSpinner /> : unread ? <MailCheck className="size-4" /> : <Mail className="size-4" />}
                        </button>
                    ) : null}
                    {canWrite && draft ? (
                        <Link
                            href={previewHref}
                            aria-label="Опубликовать"
                            className="flex shrink-0 items-center justify-center bg-foreground text-background"
                            style={{ width: SWIPE_ACTION }}
                        >
                            <Send className="size-4" />
                        </Link>
                    ) : null}
                    {canWrite && scheduled ? (
                        <button
                            type="button"
                            className="flex shrink-0 items-center justify-center bg-amber-600 text-white"
                            style={{ width: SWIPE_ACTION }}
                            aria-label="Изменить время публикации"
                            onClick={onSchedule}
                        >
                            <CalendarClock className="size-4" />
                        </button>
                    ) : null}
                    {canWrite ? (
                        <Link
                            href={`/news/${post.id}/edit`}
                            aria-label={`Изменить новость ${post.title}`}
                            aria-disabled={deleting}
                            className={cn("flex shrink-0 items-center justify-center bg-muted text-foreground", deleting && "pointer-events-none opacity-50")}
                            style={{ width: SWIPE_ACTION }}
                        >
                            <Pencil className="size-4" />
                        </Link>
                    ) : null}
                    {canWrite ? (
                        <button
                            type="button"
                            className="flex shrink-0 items-center justify-center bg-destructive text-white disabled:opacity-60"
                            style={{ width: SWIPE_ACTION }}
                            aria-label={`Удалить новость ${post.title}`}
                            disabled={deleting}
                            onClick={onDelete}
                        >
                            {deleting ? <ButtonSpinner /> : <Trash2 className="size-4" />}
                        </button>
                    ) : null}
                </div>
            ) : null}
            <div
                className={cn("relative z-10 touch-pan-y", surface, dragX === null && "transition-transform")}
                style={shown === 0 ? undefined : { transform: `translateX(${shown}px)` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endSwipe}
                onPointerCancel={endSwipe}
            >
                {cornerFill ? (
                    <>
                        <span className={cn("absolute top-0 right-0 z-0 size-[14px] sm:hidden", corner)} aria-hidden />
                        <span className={cn("absolute bottom-0 right-0 z-0 size-[14px] sm:hidden", corner)} aria-hidden />
                    </>
                ) : null}
                <Card
                    size="sm"
                    className={cn(
                        "relative z-10 ring-inset shadow-none transition-colors sm:hover:bg-muted/40 max-sm:[--card-spacing:--spacing(2)]!",
                        surface,
                        unread && "border-l-2 border-l-primary",
                    )}
                >
                    <CardHeader className="items-center">
                        <CardTitle className={cn("min-w-0", unread && "font-semibold")}>
                            <Link
                                href={href}
                                className="after:absolute after:inset-0 focus-visible:outline-none"
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
                                <span className="flex min-w-0 items-start gap-2">
                                    {unread ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                                    <span className="line-clamp-2 min-w-0 sm:line-clamp-1">
                                        {unread ? <span className="sr-only">Непрочитанная. </span> : null}
                                        {post.title}
                                    </span>
                                </span>
                            </Link>
                        </CardTitle>
                        <CardDescription className="flex min-w-0 items-center gap-2">
                            {draft ? <Badge variant="outline" className="shrink-0 border-sky-600/40 bg-sky-500/15 text-sky-950 dark:border-sky-400/40 dark:bg-sky-400/15 dark:text-sky-50">Черновик</Badge> : null}
                            {scheduled ? <Badge variant="outline" className="shrink-0 border-amber-600/50 bg-amber-500/20 text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/15 dark:text-amber-50">Отложена</Badge> : null}
                            <span className="truncate">
                                <time dateTime={post.publishedAt} suppressHydrationWarning>
                                    {formatGroupedWhen(post.publishedAt, precision)}
                                </time>
                                {` · ${newsAuthorLine(post)}`}
                            </span>
                        </CardDescription>
                        <CardAction className="relative z-10 flex items-center gap-0.5">
                            {canWrite ? (
                                <span className="hidden items-center sm:flex">
                                    {draft ? (
                                        <Link
                                            href={previewHref}
                                            aria-label="Опубликовать"
                                            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground")}
                                        >
                                            <Send />
                                        </Link>
                                    ) : null}
                                    {scheduled ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            className="text-muted-foreground"
                                            aria-label="Изменить время публикации"
                                            onClick={onSchedule}
                                        >
                                            <CalendarClock />
                                        </Button>
                                    ) : null}
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
                                        onClick={onDelete}
                                    >
                                        {deleting ? <ButtonSpinner /> : <Trash2 />}
                                    </Button>
                                </span>
                            ) : null}
                            {showRead ? (
                                <span className="hidden sm:inline-flex">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-muted-foreground"
                                        aria-label={unread ? "Отметить прочитанной" : "Отметить непрочитанной"}
                                        disabled={marking}
                                        onClick={onToggleRead}
                                    >
                                        {marking ? <ButtonSpinner /> : unread ? <MailCheck /> : <Mail />}
                                    </Button>
                                </span>
                            ) : null}
                            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </CardAction>
                    </CardHeader>
                </Card>
            </div>
        </div>
    );
}

function dayKey(iso: string): string {
    return dayKeyFromDate(new Date(iso));
}

function dayKeyFromDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function periodLabel(period: DateRange | undefined): string {
    if (!period?.from) {
        return "Выберите период";
    }
    if (!period.to || sameDay(period.from, period.to)) {
        return format(period.from, "d MMMM yyyy", { locale: ru });
    }
    return `${format(period.from, "d MMM yyyy", { locale: ru })} — ${format(period.to, "d MMM yyyy", { locale: ru })}`;
}

function sameDay(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
        && left.getMonth() === right.getMonth()
        && left.getDate() === right.getDate();
}

function localStamp(iso: string): string {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isUnread(post: NewsPost): boolean {
    return newsIsLive(post) && post.readAt === null;
}

function isScheduled(post: NewsPost): boolean {
    return post.status === "published" && new Date(post.publishedAt).getTime() > Date.now();
}

function matchesStatus(post: NewsPost, filter: NewsStatusFilter): boolean {
    if (filter === "all") {
        return true;
    }
    if (filter === "draft") {
        return post.status === "draft";
    }
    if (filter === "scheduled") {
        return isScheduled(post);
    }
    return post.status === "published" && !isScheduled(post);
}

