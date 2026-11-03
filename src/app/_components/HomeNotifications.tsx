"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { useHomeCardLimit } from "@/app/_components/home-card-limit";
import { NotificationIconButton, NotificationRows, NotificationsDialog } from "@/app/_components/notification-list";
import { notifyNotificationsChanged, onNotificationsChanged } from "@/app/_components/header/browser-notify";
import { ApiResponse } from "@/types/api";

export interface HomeNotification {
    id: number;
    kind: string;
    body: string;
    href: string;
    createdAt: string;
    readAt: string | null;
}

interface Feed {
    unread: number;
    items: HomeNotification[];
}

export function HomeNotifications({ initial }: { initial: Feed }) {
    const router = useRouter();
    const [feed, setFeed] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const [pendingAll, setPendingAll] = useState(false);
    const [openingId, setOpeningId] = useState<number | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [allOpen, setAllOpen] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const limit = useHomeCardLimit(listRef);

    async function refresh() {
        try {
            const response = await fetch("/api/notifications", { cache: "no-store" });
            const json = (await response.json()) as ApiResponse<Feed>;
            if (json.success) {
                setFeed(json.data);
            }
        } catch {
            setError("Не удалось загрузить уведомления");
        }
    }

    useEffect(() => {
        return onNotificationsChanged(() => {
            void refresh();
        });
    }, []);

    async function mark(body: { id: number; read?: boolean } | { all: true }) {
        const all = "all" in body;
        const toggle = !all && typeof body.read === "boolean";
        if (all) {
            setPendingAll(true);
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
            const json = (await response.json()) as ApiResponse<Feed>;
            if (!json.success) {
                setError(json.error.message);
                return false;
            }
            setFeed(json.data);
            notifyNotificationsChanged();
            return true;
        } catch {
            setError("Не удалось обновить уведомления");
            return false;
        } finally {
            setPendingAll(false);
            setOpeningId(null);
            setTogglingId(null);
        }
    }

    async function openItem(item: HomeNotification) {
        const saved = await mark({ id: item.id });
        if (saved) {
            router.push(item.href);
        }
    }

    const shown = homeNotifications(feed.items, limit);

    return (
        <section className="flex h-full min-h-0 flex-col gap-2 sm:gap-3">
            <div className="flex min-h-6 items-center justify-between gap-3 sm:min-h-8">
                <h2 className="flex items-center gap-2 text-xs font-semibold sm:text-base">
                    Уведомления
                    {feed.unread > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                            <span className="inline-block leading-none">{feed.unread > 9 ? "9+" : feed.unread}</span>
                        </span>
                    ) : null}
                </h2>
                <div className="flex items-center gap-1">
                    {feed.unread > 0 ? (
                        <NotificationIconButton label="Прочитать все" disabled={pendingAll} onClick={() => void mark({ all: true })}>
                            {pendingAll ? <ButtonSpinner /> : <CheckCheck />}
                        </NotificationIconButton>
                    ) : null}
                </div>
            </div>
            <FormAlert message={error} />
            <Card className="min-h-0 flex-1 gap-0 py-0! lg:h-full">
                <CardContent className="flex h-full min-h-0 flex-col gap-1 px-2! pt-1.5 pb-0 sm:gap-2 sm:px-3! sm:pt-3">
                    <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                        {shown.length === 0 ? (
                            <p className="px-2 py-1 text-xs text-muted-foreground sm:py-2 sm:text-sm">Пока нет уведомлений</p>
                        ) : (
                            <NotificationRows
                                items={shown}
                                openingId={openingId}
                                togglingId={togglingId}
                                grouped={false}
                                compact
                                onOpen={(item) => void openItem(item)}
                                onToggle={(item) => void mark({ id: item.id, read: item.readAt === null })}
                            />
                        )}
                    </div>
                    {feed.items.length > 0 ? (
                        <div className="mt-auto flex h-8 shrink-0 items-center border-t px-1 sm:h-12 sm:px-2">
                            <button type="button" className="text-left text-xs text-muted-foreground hover:text-foreground sm:text-sm" onClick={() => setAllOpen(true)}>
                                Показать все
                            </button>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
            <NotificationsDialog
                open={allOpen}
                onOpenChange={setAllOpen}
                items={feed.items}
                unread={feed.unread}
                error={error}
                pendingAll={pendingAll}
                openingId={openingId}
                togglingId={togglingId}
                onReadAll={() => void mark({ all: true })}
                onOpenItem={(item) => {
                    setAllOpen(false);
                    void openItem(item);
                }}
                onToggle={(item) => void mark({ id: item.id, read: item.readAt === null })}
            />
        </section>
    );
}

function homeNotifications(items: HomeNotification[], limit: number): HomeNotification[] {
    const sorted = [...items].sort((left, right) => {
        const diff = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        return diff !== 0 ? diff : right.id - left.id;
    });
    const unread = sorted.filter((item) => item.readAt === null);
    const read = sorted.filter((item) => item.readAt !== null);
    return [...unread, ...read].slice(0, limit);
}
