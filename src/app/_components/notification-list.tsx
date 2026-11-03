"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckCheck, ChevronDown, Inbox, Mail, MailCheck, MessageSquareText, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ButtonSpinner } from "@/components/loading-state";
import { formatGroupedWhen, groupByDate, type DateGroupPrecision } from "@/lib/date-groups";
import { cn } from "@/lib/utils";

export interface NotificationEntry {
    id: number;
    kind: string;
    body: string;
    href: string;
    createdAt: string;
    readAt: string | null;
}

const NOTIFICATION_KINDS: Record<string, { label: string; icon: LucideIcon }> = {
    feedback: { label: "Обратная связь", icon: MessageSquareText },
};

const PREVIEW_COUNTS = [5, 10, 20] as const;
export const HOME_PREVIEW_COUNT = 5 as const;
const COUNT_KEY = "srp:notification-preview-count";
const UNREAD_KEY = "srp:notification-unread-only";
const VIEW_EVENT = "srp:notification-view";

export type PreviewCount = (typeof PREVIEW_COUNTS)[number];

interface NotificationGroup {
    key: string;
    label: string;
    precision: DateGroupPrecision;
    items: NotificationEntry[];
}

function notificationKind(kind: string): { label: string; icon: LucideIcon } {
    return NOTIFICATION_KINDS[kind] ?? { label: "Уведомление", icon: Inbox };
}

function isPreviewCount(value: number): value is PreviewCount {
    return (PREVIEW_COUNTS as readonly number[]).includes(value);
}

function readPreviewCount(): PreviewCount {
    const value = Number(window.localStorage.getItem(COUNT_KEY));
    return isPreviewCount(value) ? value : 5;
}

function readUnreadOnly(): boolean {
    return window.localStorage.getItem(UNREAD_KEY) !== "off";
}

function nextPreviewCount(count: PreviewCount): PreviewCount {
    return PREVIEW_COUNTS[(PREVIEW_COUNTS.indexOf(count) + 1) % PREVIEW_COUNTS.length];
}

export function useNotificationPreview(): {
    count: PreviewCount;
    unreadOnly: boolean;
    setCount: (count: PreviewCount) => void;
    setUnreadOnly: (unreadOnly: boolean) => void;
} {
    const [count, setCountState] = useState<PreviewCount>(5);
    const [unreadOnly, setUnreadOnlyState] = useState(true);

    useEffect(() => {
        function read() {
            setCountState(readPreviewCount());
            setUnreadOnlyState(readUnreadOnly());
        }
        read();
        window.addEventListener(VIEW_EVENT, read);
        return () => window.removeEventListener(VIEW_EVENT, read);
    }, []);

    function setCount(next: PreviewCount) {
        window.localStorage.setItem(COUNT_KEY, String(next));
        window.dispatchEvent(new Event(VIEW_EVENT));
    }

    function setUnreadOnly(next: boolean) {
        window.localStorage.setItem(UNREAD_KEY, next ? "on" : "off");
        window.dispatchEvent(new Event(VIEW_EVENT));
    }

    return { count, unreadOnly, setCount, setUnreadOnly };
}

export function previewNotifications(items: NotificationEntry[], count: PreviewCount, unreadOnly: boolean): NotificationEntry[] {
    const source = unreadOnly ? items.filter((item) => item.readAt === null) : items;
    return sortNotifications(source).slice(0, count);
}

function sortNotifications(items: NotificationEntry[]): NotificationEntry[] {
    return [...items].sort((left, right) => {
        const diff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        return diff !== 0 ? diff : right.id - left.id;
    });
}

function groupNotifications(items: NotificationEntry[], now = new Date()): NotificationGroup[] {
    return groupByDate(items, (item) => item.createdAt, now);
}

function rowWhen(createdAt: string, precision: DateGroupPrecision): string {
    return formatGroupedWhen(createdAt, precision);
}

function Segmented({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div role="group" aria-label={label} className="flex rounded-md bg-muted p-0.5">
            {children}
        </div>
    );
}

function Segment({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            className={cn(
                "rounded-[min(var(--radius-md),8px)] px-2 py-1 text-xs whitespace-nowrap",
                pressed ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

export function NotificationIconButton({
    label,
    disabled,
    pressed,
    onClick,
    children,
}: {
    label: string;
    disabled?: boolean;
    pressed?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
            aria-pressed={pressed}
            disabled={disabled}
            className={cn(pressed && "bg-muted text-primary")}
            onClick={onClick}
        >
            {children}
        </Button>
    );
}

export function NotificationAreaFilters({
    unreadOnly,
    onUnreadOnly,
}: {
    unreadOnly: boolean;
    onUnreadOnly: (unreadOnly: boolean) => void;
}) {
    return (
        <NotificationIconButton label="Только непрочитанные" pressed={unreadOnly} onClick={() => onUnreadOnly(!unreadOnly)}>
            <Mail />
        </NotificationIconButton>
    );
}

export function NotificationCountButton({
    count,
    onCount,
}: {
    count: PreviewCount;
    onCount: (count: PreviewCount) => void;
}) {
    return (
        <NotificationIconButton label={`Показывать ${count}`} onClick={() => onCount(nextPreviewCount(count))}>
            <span className="text-xs tabular-nums">{count}</span>
        </NotificationIconButton>
    );
}

const SWIPE_ACTION = 44;
const SWIPE_COMMIT = 28;

function NotificationRow({
    item,
    precision,
    opening,
    toggling,
    compact = false,
    revealed,
    onReveal,
    onOpen,
    onToggle,
}: {
    item: NotificationEntry;
    precision: DateGroupPrecision;
    opening: boolean;
    toggling: boolean;
    compact?: boolean;
    revealed: boolean;
    onReveal: (id: number | null) => void;
    onOpen: (item: NotificationEntry) => void;
    onToggle: (item: NotificationEntry) => void;
}) {
    const unread = item.readAt === null;
    const kind = notificationKind(item.kind);
    const KindIcon = kind.icon;
    const busy = opening || toggling;
    const statusLabel = unread ? "Отметить прочитанным" : "Отметить непрочитанным";
    const surface = unread
        ? "bg-[color-mix(in_oklab,var(--primary)_15%,var(--background))] hover:bg-[color-mix(in_oklab,var(--primary)_20%,var(--background))]"
        : "bg-background hover:bg-muted";
    const [dragX, setDragX] = useState<number | null>(null);
    const drag = useRef<{ pointerId: number; x: number; y: number; origin: number; swiping: boolean } | null>(null);
    const ignoreClick = useRef(false);
    const shown = dragX ?? (revealed ? -SWIPE_ACTION : 0);
    const cornerFill = revealed && dragX === null;

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
        if (event.pointerType === "mouse" || busy) {
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
        onReveal(next <= -SWIPE_COMMIT ? item.id : null);
    }

    return (
        <div data-home-row={compact ? "" : undefined} className={cn("relative overflow-hidden rounded-xl sm:rounded-md", compact && "h-10 shrink-0 sm:h-14")}>
            <div className="absolute inset-y-0 right-0 z-0 flex w-11 sm:hidden">
                <button
                    type="button"
                    className="flex w-full items-center justify-center bg-primary text-primary-foreground disabled:opacity-60"
                    aria-label={statusLabel}
                    disabled={busy}
                    onClick={() => onToggle(item)}
                >
                    {toggling ? <ButtonSpinner /> : unread ? <MailCheck className="size-4" /> : <Mail className="size-4" />}
                </button>
            </div>
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
                        <span className="absolute top-0 right-0 z-0 size-[14px] bg-primary sm:hidden" aria-hidden />
                        <span className="absolute bottom-0 right-0 z-0 size-[14px] bg-primary sm:hidden" aria-hidden />
                    </>
                ) : null}
                <button
                    type="button"
                    className={cn(
                        "relative z-10 flex w-full gap-1.5 rounded-xl text-left transition-colors disabled:opacity-60 sm:rounded-md",
                        compact
                            ? "h-10 items-center py-0 pr-1.5 pl-1.5 sm:h-14 sm:pr-12 sm:pl-2"
                            : "items-start px-2 py-1.5 sm:pr-12",
                        surface,
                        unread && "border-l-2 border-primary",
                    )}
                    disabled={busy}
                    onClick={() => {
                        if (ignoreClick.current) {
                            ignoreClick.current = false;
                            return;
                        }
                        if (revealed) {
                            onReveal(null);
                            return;
                        }
                        onOpen(item);
                    }}
                >
                    <span className="flex h-5 shrink-0 items-center" title={kind.label}>
                        <KindIcon
                            className={cn("size-3.5 -translate-y-px", unread ? "text-primary" : "text-muted-foreground")}
                            aria-hidden
                        />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="sr-only">{unread ? `${kind.label}. Непрочитано. ` : `${kind.label}. `}</span>
                        <span className={cn("block text-sm", compact && "truncate text-[11px] leading-4 sm:text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>{item.body}</span>
                        <span className={cn("mt-0.5 block text-xs text-muted-foreground", compact && "mt-0 text-[10px] leading-3 sm:mt-0.5 sm:text-xs sm:leading-4")} suppressHydrationWarning>
                            {rowWhen(item.createdAt, precision)}
                        </span>
                    </span>
                    {opening ? <ButtonSpinner /> : null}
                </button>
                <span className={cn("absolute right-1 z-10 hidden sm:inline-flex", compact ? "top-1/2 -translate-y-1/2" : "top-1.5")}>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        aria-label={statusLabel}
                        title={statusLabel}
                        disabled={busy}
                        onClick={() => onToggle(item)}
                    >
                        {toggling ? <ButtonSpinner /> : unread ? <MailCheck /> : <Mail />}
                    </Button>
                </span>
            </div>
        </div>
    );
}

export function NotificationRows({
    items,
    openingId,
    togglingId,
    grouped = true,
    compact = false,
    onOpen,
    onToggle,
}: {
    items: NotificationEntry[];
    openingId: number | null;
    togglingId: number | null;
    grouped?: boolean;
    compact?: boolean;
    onOpen: (item: NotificationEntry) => void;
    onToggle: (item: NotificationEntry) => void;
}) {
    const [openSwipeId, setOpenSwipeId] = useState<number | null>(null);
    if (!grouped) {
        return (
            <>
                {items.map((item) => (
                    <NotificationRow
                        key={item.id}
                        item={item}
                        precision="month"
                        opening={openingId === item.id}
                        toggling={togglingId === item.id}
                        compact={compact}
                        revealed={openSwipeId === item.id}
                        onReveal={setOpenSwipeId}
                        onOpen={onOpen}
                        onToggle={onToggle}
                    />
                ))}
            </>
        );
    }
    const groups = groupNotifications(items);
    return (
        <>
            {groups.map((group) => (
                <div key={group.key} className="flex flex-col gap-1">
                    <p className="px-2 pt-1.5 text-xs font-medium text-muted-foreground" suppressHydrationWarning>{group.label}</p>
                    {group.items.map((item) => (
                        <NotificationRow
                            key={item.id}
                            item={item}
                            precision={group.precision}
                            opening={openingId === item.id}
                            toggling={togglingId === item.id}
                            revealed={openSwipeId === item.id}
                            onReveal={setOpenSwipeId}
                            onOpen={onOpen}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            ))}
        </>
    );
}

function sectionSummary(kinds: { code: string; label: string }[], selected: string[], allSelected: boolean): string {
    if (allSelected || kinds.length === 0) {
        return "Все разделы";
    }
    if (selected.length === 0) {
        return "Разделы";
    }
    if (selected.length === 1) {
        return kinds.find((item) => item.code === selected[0])?.label ?? "Разделы";
    }
    const count = selected.length;
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11 ? "раздел" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "раздела" : "разделов";
    return `${count} ${word}`;
}

function NotificationKindFilter({
    kinds,
    selected,
    allSelected,
    onToggle,
    onToggleAll,
}: {
    kinds: { code: string; label: string; icon: LucideIcon }[];
    selected: string[];
    allSelected: boolean;
    onToggle: (code: string) => void;
    onToggleAll: () => void;
}) {
    if (kinds.length === 0) {
        return null;
    }
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button type="button" variant="outline" size="sm" className="h-7 max-w-full gap-1 px-2 text-xs font-normal">
                        <span className="truncate">{sectionSummary(kinds, selected, allSelected)}</span>
                        <ChevronDown className="size-3 text-muted-foreground" />
                    </Button>
                }
            />
            <PopoverContent align="start" className="w-60 gap-1 p-2">
                <Label className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                    <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
                    <span className="truncate">Все</span>
                </Label>
                {kinds.map((item) => {
                    const KindIcon = item.icon;
                    return (
                        <Label key={item.code} className="rounded-md px-2 py-1.5 font-normal hover:bg-muted">
                            <Checkbox checked={selected.includes(item.code)} onCheckedChange={() => onToggle(item.code)} />
                            <KindIcon className="size-3.5 text-muted-foreground" aria-hidden />
                            <span className="truncate">{item.label}</span>
                        </Label>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

export function NotificationsDialog({
    open,
    onOpenChange,
    items,
    unread,
    error,
    pendingAll,
    openingId,
    togglingId,
    onReadAll,
    onOpenItem,
    onToggle,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: NotificationEntry[];
    unread: number;
    error: string | null;
    pendingAll: boolean;
    openingId: number | null;
    togglingId: number | null;
    onReadAll: () => void;
    onOpenItem: (item: NotificationEntry) => void;
    onToggle: (item: NotificationEntry) => void;
}) {
    const [scope, setScope] = useState<"all" | "unread">("all");
    const [picked, setPicked] = useState<string[] | null>(null);
    const kinds = [...new Set(items.map((item) => item.kind))]
        .map((code) => ({ code, ...notificationKind(code) }))
        .sort((left, right) => left.label.localeCompare(right.label, "ru"));
    const selected = picked ?? kinds.map((item) => item.code);
    const allSelected = kinds.every((item) => selected.includes(item.code));
    const visible = sortNotifications(
        items.filter((item) => (scope === "all" || item.readAt === null) && (picked === null || picked.includes(item.kind))),
    );

    function toggleKind(code: string) {
        const next = selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];
        setPicked(kinds.every((item) => next.includes(item.code)) ? null : next);
    }

    function toggleAllKinds() {
        setPicked(allSelected ? [] : null);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[min(40rem,calc(100dvh-2rem))] flex-col gap-4 overflow-hidden sm:max-w-lg">
                <DialogHeader className="shrink-0 pr-8">
                    <div className="flex items-center gap-2">
                        <DialogTitle>Уведомления</DialogTitle>
                        {unread > 0 ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                                {unread > 9 ? "9+" : unread}
                            </span>
                        ) : null}
                        {unread > 0 ? (
                            <NotificationIconButton label="Прочитать все" disabled={pendingAll} onClick={onReadAll}>
                                {pendingAll ? <ButtonSpinner /> : <CheckCheck />}
                            </NotificationIconButton>
                        ) : null}
                    </div>
                </DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                    <Segmented label="Какие показывать">
                        <Segment pressed={scope === "all"} onClick={() => setScope("all")}>Все</Segment>
                        <Segment pressed={scope === "unread"} onClick={() => setScope("unread")}>Непрочитанные</Segment>
                    </Segmented>
                    <NotificationKindFilter
                        kinds={kinds}
                        selected={selected}
                        allSelected={allSelected}
                        onToggle={toggleKind}
                        onToggleAll={toggleAllKinds}
                    />
                </div>
                {error ? <p className="text-xs text-destructive">{error}</p> : null}
                {visible.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{items.length === 0 ? "Пока нет уведомлений" : "Нет таких уведомлений"}</p>
                ) : (
                    <div className="-mx-2 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
                        <NotificationRows items={visible} openingId={openingId} togglingId={togglingId} onOpen={onOpenItem} onToggle={onToggle} />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
