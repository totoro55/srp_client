"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, BellRing, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ButtonSpinner } from "@/components/loading-state";
import { NotificationAreaFilters, NotificationCountButton, NotificationIconButton, NotificationRows, NotificationsDialog, previewNotifications, useNotificationPreview } from "@/app/_components/notification-list";
import {
    announceBrowserNotification,
    browserNotificationCapability,
    browserNotificationsEnabled,
    notifyNotificationsChanged,
    requestBrowserNotificationPermission,
    setBrowserNotificationsEnabled,
    type BrowserNotificationCapability,
} from "./browser-notify";
import { startNotificationPoll } from "./notification-poll";
import { ApiResponse } from "@/types/api";

interface NotificationItem {
    id: number;
    kind: string;
    body: string;
    href: string;
    createdAt: string;
    readAt: string | null;
}

interface NotificationFeed {
    unread: number;
    items: NotificationItem[];
}

interface NotificationSummary {
    unread: number;
    latestId: number | null;
}

const POLL_MS = 8000;

export function NotificationBell() {
    const router = useRouter();
    const [feed, setFeed] = useState<NotificationFeed | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [openingId, setOpeningId] = useState<number | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [allOpen, setAllOpen] = useState(false);
    const [browserOn, setBrowserOn] = useState(false);
    const [permission, setPermission] = useState<BrowserNotificationCapability>("default");
    const [browserHint, setBrowserHint] = useState<string | null>(null);
    const { count, unreadOnly, setCount, setUnreadOnly } = useNotificationPreview();
    const announced = useRef(new Set<number>());
    const primed = useRef(false);
    const latestSeen = useRef<number | null | undefined>(undefined);
    const unreadSeen = useRef<number | undefined>(undefined);
    const menuOpenRef = useRef(false);
    const allOpenRef = useRef(false);
    const loadListRef = useRef<() => Promise<boolean>>(async () => false);

    const applyFeed = useCallback((data: NotificationFeed) => {
        setFeed(data);
        latestSeen.current = data.items[0]?.id ?? null;
        unreadSeen.current = data.unread;
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const capability = browserNotificationCapability();
            setPermission(capability);
            setBrowserOn(capability === "granted" && browserNotificationsEnabled());
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        let stopped = false;
        const controller = new AbortController();

        async function loadList() {
            try {
                const response = await fetch("/api/notifications", { signal: controller.signal, cache: "no-store" });
                const json = (await response.json()) as ApiResponse<NotificationFeed>;
                if (stopped || !json.success) {
                    if (!stopped && !json.success) {
                        setError(json.error.message);
                    }
                    return false;
                }
                setError(null);
                applyFeed(json.data);
                const unreadItems = json.data.items.filter((item) => item.readAt === null);
                let arrived = false;
                if (primed.current) {
                    for (const item of unreadItems) {
                        if (!announced.current.has(item.id)) {
                            announceBrowserNotification(item.body);
                            announced.current.add(item.id);
                            arrived = true;
                        }
                    }
                } else {
                    primed.current = true;
                    for (const item of json.data.items) {
                        announced.current.add(item.id);
                    }
                }
                if (arrived) {
                    notifyNotificationsChanged();
                }
                return true;
            } catch {
                if (!stopped) {
                    setError("Не удалось загрузить уведомления");
                }
                return false;
            }
        }

        async function loadSummary() {
            try {
                const response = await fetch("/api/notifications?summary=1", { signal: controller.signal, cache: "no-store" });
                const json = (await response.json()) as ApiResponse<NotificationSummary>;
                if (stopped || !json.success) {
                    if (!stopped && !json.success) {
                        setError(json.error.message);
                    }
                    return;
                }
                setError(null);
                const summary = json.data;
                const latestChanged = latestSeen.current !== summary.latestId;
                const unreadChanged = unreadSeen.current !== summary.unread;
                const listOpen = menuOpenRef.current || allOpenRef.current;
                if (latestChanged || (listOpen && unreadChanged)) {
                    const loaded = await loadList();
                    if (!loaded || stopped) {
                        return;
                    }
                    return;
                }
                latestSeen.current = summary.latestId;
                unreadSeen.current = summary.unread;
                setFeed((current) => current === null ? current : { ...current, unread: summary.unread });
            } catch {
                if (!stopped) {
                    setError("Не удалось загрузить уведомления");
                }
            }
        }

        loadListRef.current = () => loadList();
        const stopPoll = startNotificationPoll({
            intervalMs: POLL_MS,
            hidden: () => document.hidden,
            load: loadSummary,
            listenVisibility: (onChange) => {
                document.addEventListener("visibilitychange", onChange);
                return () => document.removeEventListener("visibilitychange", onChange);
            },
        });
        return () => {
            stopped = true;
            loadListRef.current = async () => false;
            stopPoll();
            controller.abort();
        };
    }, [applyFeed]);

    async function mark(body: { id: number; read?: boolean } | { all: true }) {
        const all = "all" in body;
        const toggle = !all && typeof body.read === "boolean";
        if (all) {
            setPending(true);
        } else if (toggle) {
            setTogglingId(body.id);
        } else {
            setOpeningId(body.id);
        }
        setError(null);
        try {
            const response = await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const json = (await response.json()) as ApiResponse<NotificationFeed>;
            if (!json.success) {
                setError(json.error.message);
                return null;
            }
            applyFeed(json.data);
            notifyNotificationsChanged();
            return json.data;
        } catch {
            setError("Не удалось обновить уведомления");
            return null;
        } finally {
            setPending(false);
            setOpeningId(null);
            setTogglingId(null);
        }
    }

    async function openItem(item: NotificationItem) {
        await mark({ id: item.id });
        router.push(item.href);
    }

    async function enableBrowser() {
        setBrowserHint(null);
        const next = await requestBrowserNotificationPermission();
        setPermission(next);
        if (next === "insecure") {
            setBrowserNotificationsEnabled(false);
            setBrowserOn(false);
            return;
        }
        if (next === "missing") {
            setBrowserHint("Этот браузер не поддерживает уведомления.");
            setBrowserNotificationsEnabled(false);
            setBrowserOn(false);
            return;
        }
        if (next === "denied") {
            setBrowserHint("Браузер запретил уведомления. Разрешите их в настройках сайта.");
            setBrowserNotificationsEnabled(false);
            setBrowserOn(false);
            return;
        }
        setBrowserNotificationsEnabled(true);
        setBrowserOn(true);
        announceBrowserNotification("Уведомления СРП включены", { force: true });
    }

    function disableBrowser() {
        setBrowserHint(null);
        setBrowserNotificationsEnabled(false);
        setBrowserOn(false);
    }

    const unread = feed?.unread ?? 0;
    const allItems = feed?.items ?? [];
    const items = previewNotifications(allItems, count, unreadOnly);
    const label = unread > 0 ? `Уведомления, непрочитанных: ${unread > 9 ? "9+" : unread}` : "Уведомления";
    const browserBlocked = permission === "denied" || permission === "missing";
    const browserSilent = permission === "insecure";
    const browserLabel = permission === "insecure"
        ? "Уведомления браузера"
        : permission === "missing"
        ? "Уведомления браузера недоступны"
        : permission === "denied"
            ? "Браузер запретил уведомления"
            : browserOn
                ? "Выключить уведомления браузера"
                : "Включить уведомления браузера";

    return (
        <>
            <Popover open={menuOpen} onOpenChange={(open) => {
                menuOpenRef.current = open;
                setMenuOpen(open);
                if (open) {
                    void loadListRef.current();
                }
            }}>
                <PopoverTrigger
                    render={
                        <Button type="button" variant="ghost" size="icon-sm" className="relative shrink-0" aria-label={label} />
                    }
                >
                    <Bell />
                    {unread > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                            <span className="inline-block translate-y-[0.5px] leading-none">{unread > 9 ? "9+" : unread}</span>
                        </span>
                    ) : null}
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 gap-2 p-2">
                    <div className="flex items-center gap-1 px-1 py-1">
                        <p className="mr-auto text-sm font-medium">Уведомления</p>
                        {unread > 0 ? (
                            <NotificationIconButton label="Прочитать все" disabled={pending} onClick={() => void mark({ all: true })}>
                                {pending ? <ButtonSpinner /> : <CheckCheck />}
                            </NotificationIconButton>
                        ) : null}
                        <NotificationIconButton
                            label={browserLabel}
                            onClick={() => {
                                if (permission === "insecure") {
                                    return;
                                }
                                if (browserBlocked && !browserOn) {
                                    setBrowserHint(
                                        permission === "denied"
                                            ? "Браузер запретил уведомления. Разрешите их в настройках сайта."
                                            : "Этот браузер не поддерживает уведомления.",
                                    );
                                    return;
                                }
                                void (browserOn ? disableBrowser() : enableBrowser());
                            }}
                        >
                            {browserBlocked || browserSilent ? <BellOff /> : browserOn ? <BellRing className="text-primary" /> : <Bell />}
                        </NotificationIconButton>
                        <NotificationAreaFilters unreadOnly={unreadOnly} onUnreadOnly={setUnreadOnly} />
                        <NotificationCountButton count={count} onCount={setCount} />
                    </div>
                    {browserHint ? <p className="px-2 text-xs text-muted-foreground">{browserHint}</p> : null}
                    {error ? <p className="px-2 text-xs text-destructive">{error}</p> : null}
                    {feed === null && error === null ? (
                        <div className="flex flex-col gap-2 px-2 py-2" aria-hidden>
                            <div className="h-8 animate-pulse rounded bg-muted" />
                            <div className="h-8 animate-pulse rounded bg-muted" />
                        </div>
                    ) : null}
                    {feed && items.length === 0 ? (
                        <p className="px-2 py-3 text-sm text-muted-foreground">{unreadOnly && allItems.length > 0 ? "Нет непрочитанных" : "Пока нет уведомлений"}</p>
                    ) : null}
                    {items.length > 0 ? (
                        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                            <NotificationRows
                                items={items}
                                openingId={openingId}
                                togglingId={togglingId}
                                onOpen={(item) => void openItem(item)}
                                onToggle={(item) => void mark({ id: item.id, read: item.readAt === null })}
                            />
                        </div>
                    ) : null}
                    {allItems.length > 0 ? (
                        <button
                            type="button"
                            className="border-t px-2 pt-2 text-left text-sm text-muted-foreground hover:text-foreground"
                            onClick={() => {
                                menuOpenRef.current = false;
                                setMenuOpen(false);
                                window.setTimeout(() => {
                                    allOpenRef.current = true;
                                    setAllOpen(true);
                                    void loadListRef.current();
                                }, 0);
                            }}
                        >
                            Показать все
                        </button>
                    ) : null}
                </PopoverContent>
            </Popover>
            <NotificationsDialog
                open={allOpen}
                onOpenChange={(open) => {
                    allOpenRef.current = open;
                    setAllOpen(open);
                    if (open) {
                        void loadListRef.current();
                    }
                }}
                items={feed?.items ?? []}
                unread={unread}
                error={error}
                pendingAll={pending}
                openingId={openingId}
                togglingId={togglingId}
                onReadAll={() => void mark({ all: true })}
                onOpenItem={(item) => {
                    allOpenRef.current = false;
                    setAllOpen(false);
                    void openItem(item);
                }}
                onToggle={(item) => void mark({ id: item.id, read: item.readAt === null })}
            />
        </>
    );
}
