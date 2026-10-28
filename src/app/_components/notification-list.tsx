"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CheckCheck, ChevronDown, Inbox, Mail, MailOpen, MessageSquareText, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ButtonSpinner } from "@/components/loading-state";
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
const NEAR_DAYS = 7;

export type PreviewCount = (typeof PREVIEW_COUNTS)[number];

type GroupPrecision = "day" | "month" | "year";

interface NotificationGroup {
    key: string;
    label: string;
    precision: GroupPrecision;
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

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBefore(date: Date, now: Date): number {
    return Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / 86400000);
}

function capitalize(text: string): string {
    return text.length === 0 ? text : text.charAt(0).toUpperCase() + text.slice(1);
}

function notificationGroup(createdAt: string, now: Date): Omit<NotificationGroup, "items"> {
    const date = new Date(createdAt);
    const age = daysBefore(date, now);
    if (age >= 0 && age < NEAR_DAYS) {
        const label = age === 0
            ? "Сегодня"
            : age === 1
                ? "Вчера"
                : capitalize(date.toLocaleDateString("ru-RU", date.getFullYear() === now.getFullYear()
                    ? { day: "numeric", month: "long" }
                    : { day: "numeric", month: "long", year: "numeric" }));
        return {
            key: `day:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
            label,
            precision: "day",
        };
    }
    const yearAgo = startOfDay(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    if (startOfDay(date).getTime() < yearAgo.getTime()) {
        return { key: `year:${date.getFullYear()}`, label: String(date.getFullYear()), precision: "year" };
    }
    return {
        key: `month:${date.getFullYear()}-${date.getMonth()}`,
        label: capitalize(date.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })),
        precision: "month",
    };
}

function groupNotifications(items: NotificationEntry[], now = new Date()): NotificationGroup[] {
    const groups: NotificationGroup[] = [];
    for (const item of items) {
        const group = notificationGroup(item.createdAt, now);
        const last = groups[groups.length - 1];
        if (last && last.key === group.key) {
            last.items.push(item);
            continue;
        }
        groups.push({ ...group, items: [item] });
    }
    return groups;
}

function rowWhen(createdAt: string, precision: GroupPrecision): string {
    const date = new Date(createdAt);
    if (precision === "day") {
        return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    if (precision === "month") {
        return date.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleString("ru-RU", { day: "numeric", month: "short" });
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

const SWIPE_LIMIT = 112;
const SWIPE_COMMIT = 72;

function NotificationRow({
    item,
    precision,
    opening,
    toggling,
    onOpen,
    onToggle,
}: {
    item: NotificationEntry;
    precision: GroupPrecision;
    opening: boolean;
    toggling: boolean;
    onOpen: (item: NotificationEntry) => void;
    onToggle: (item: NotificationEntry) => void;
}) {
    const unread = item.readAt === null;
    const kind = notificationKind(item.kind);
    const KindIcon = kind.icon;
    const busy = opening || toggling;
    const statusLabel = unread ? "Прочитано" : "Не прочитано";
    const [offset, setOffset] = useState(0);
    const offsetRef = useRef(0);
    const drag = useRef<{ pointerId: number; x: number; y: number; swiping: boolean } | null>(null);
    const ignoreClick = useRef(false);

    function moveRow(next: number) {
        offsetRef.current = next;
        setOffset(next);
    }

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        if (event.pointerType === "mouse" || busy) {
            return;
        }
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, swiping: false };
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
            if (dx > -10) {
                return;
            }
            current.swiping = true;
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // The gesture can continue without capture if the pointer has already ended.
            }
        }
        moveRow(Math.max(-SWIPE_LIMIT, Math.min(0, dx)));
    }

    function endSwipe(event: ReactPointerEvent<HTMLDivElement>) {
        const current = drag.current;
        if (!current || current.pointerId !== event.pointerId) {
            return;
        }
        const commit = current.swiping && offsetRef.current <= -SWIPE_COMMIT;
        drag.current = null;
        moveRow(0);
        if (!current.swiping) {
            return;
        }
        ignoreClick.current = true;
        window.setTimeout(() => {
            ignoreClick.current = false;
        }, 400);
        if (commit) {
            onToggle(item);
        }
    }

    return (
        <div className="relative overflow-hidden rounded-md">
            <div
                className={cn(
                    "absolute inset-y-0 right-0 flex w-28 items-center justify-center px-2 text-center text-xs font-medium",
                    unread ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
                aria-hidden
            >
                {statusLabel}
            </div>
            <div
                className={cn("relative bg-background touch-pan-y", offset === 0 && "transition-transform")}
                style={offset === 0 ? undefined : { transform: `translateX(${offset}px)` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endSwipe}
                onPointerCancel={endSwipe}
            >
                <button
                    type="button"
                    className={cn(
                        "flex w-full items-start gap-1.5 rounded-md px-2 py-1.5 text-left disabled:opacity-60 md:pr-10",
                        unread ? "border-l-2 border-primary bg-primary/15 hover:bg-primary/20" : "hover:bg-muted",
                    )}
                    disabled={busy}
                    onClick={() => {
                        if (ignoreClick.current) {
                            ignoreClick.current = false;
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
                        <span className={cn("block text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>{item.body}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground" suppressHydrationWarning>
                            {rowWhen(item.createdAt, precision)}
                        </span>
                    </span>
                    {opening ? <ButtonSpinner /> : null}
                </button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-1.5 right-1 hidden md:inline-flex"
                    aria-label={statusLabel}
                    title={statusLabel}
                    disabled={busy}
                    onClick={() => onToggle(item)}
                >
                    {toggling ? <ButtonSpinner /> : unread ? <MailOpen /> : <Mail />}
                </Button>
            </div>
        </div>
    );
}

export function NotificationRows({
    items,
    openingId,
    togglingId,
    onOpen,
    onToggle,
}: {
    items: NotificationEntry[];
    openingId: number | null;
    togglingId: number | null;
    onOpen: (item: NotificationEntry) => void;
    onToggle: (item: NotificationEntry) => void;
}) {
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
