"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/form-alert";
import { ButtonSpinner } from "@/components/loading-state";
import { HOME_PREVIEW_COUNT, NotificationIconButton, NotificationRows, NotificationsDialog, previewNotifications } from "@/app/_components/notification-list";
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

    useEffect(() => {
        return onNotificationsChanged(() => {
            void refresh();
        });
    }, []);

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

    const shown = previewNotifications(feed.items, HOME_PREVIEW_COUNT, true);

    return (
        <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                    Уведомления
                    {feed.unread > 0 ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                            {feed.unread > 9 ? "9+" : feed.unread}
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
            <Card>
                <CardContent className="flex flex-col gap-1">
                    {shown.length === 0 ? (
                        <p className="px-2 py-2 text-sm text-muted-foreground">{feed.items.length > 0 ? "Нет непрочитанных" : "Пока нет уведомлений"}</p>
                    ) : (
                        <NotificationRows
                            items={shown}
                            openingId={openingId}
                            togglingId={togglingId}
                            onOpen={(item) => void openItem(item)}
                            onToggle={(item) => void mark({ id: item.id, read: item.readAt === null })}
                        />
                    )}
                    {feed.items.length > 0 ? (
                        <button type="button" className="border-t px-2 pt-2 text-left text-sm text-muted-foreground hover:text-foreground" onClick={() => setAllOpen(true)}>
                            Показать все
                        </button>
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
