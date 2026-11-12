"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActivityIcon, CircleCheckIcon, CircleIcon, CircleXIcon, ListChecksIcon, LoaderCircleIcon, Minimize2Icon } from "lucide-react";
import { RecalcJournalLog, recalcConsoleStatus, type RecalcConsoleStatus } from "@/components/recalc-journal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAccess } from "@/hooks/useAccess";
import { RECALC_CONSOLE_EVENT, syncRecalcPlan, useRecalcPlan } from "@/lib/recalc-plan";
import { cn } from "@/lib/utils";
import type { BasketRecalcRun } from "@/services/basket-updates";
import type { ApiResponse } from "@/types/api";

const STATUS_LABEL: Record<Exclude<RecalcConsoleStatus, "idle">, string> = {
    running: "Журнал пересчёта, идёт",
    pending: "Журнал пересчёта, в очереди",
    failed: "Журнал пересчёта, ошибка",
    done: "Журнал пересчёта, готово",
};

export function RecalcJournalButton() {
    const plan = useRecalcPlan();
    const access = useAccess();
    const canOpenJournal = access.has("monitoring:read");
    const [events, setEvents] = useState<BasketRecalcRun[]>([]);
    const [open, setOpen] = useState(false);
    const [landed, setLanded] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const closing = useRef(false);
    const status = recalcConsoleStatus(events, plan);

    function collapse() {
        if (closing.current) {
            return;
        }
        const popup = popupRef.current;
        const target = buttonRef.current;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!popup || !target || reduce) {
            closing.current = true;
            setOpen(false);
            return;
        }
        closing.current = true;
        const from = popup.getBoundingClientRect();
        const to = target.getBoundingClientRect();
        const dx = to.left + to.width / 2 - (from.left + from.width / 2);
        const dy = to.top + to.height / 2 - (from.top + from.height / 2);
        const scale = Math.min(Math.max(to.width / from.width, 0.05), 0.2);
        popup.style.overflow = "hidden";
        popup.animate(
            [
                { translate: "-50% -50%", scale: 1, opacity: 1, borderRadius: "12px" },
                { translate: `calc(-50% + ${dx}px) calc(-50% + ${dy}px)`, scale, opacity: 0.2, borderRadius: "999px" },
            ],
            { duration: 380, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
        );
        popup.previousElementSibling?.animate(
            [{ opacity: 1 }, { opacity: 0 }],
            { duration: 280, easing: "ease-out", fill: "forwards" },
        );
        window.setTimeout(() => {
            setLanded(true);
            setOpen(false);
            window.setTimeout(() => setLanded(false), 320);
        }, 380);
    }

    useEffect(() => {
        const onConsole = (event: Event) => {
            if (event instanceof CustomEvent && event.detail?.open === true) {
                closing.current = false;
                setOpen(true);
            }
        };
        window.addEventListener(RECALC_CONSOLE_EVENT, onConsole);
        return () => window.removeEventListener(RECALC_CONSOLE_EVENT, onConsole);
    }, []);

    useEffect(() => {
        let stopped = false;
        let timer = 0;
        const controller = new AbortController();
        // Свёрнутый журнал не опрашивает сервер, пока нет идущего или ожидающего шага.
        let live = open || plan !== null;

        function arm() {
            window.clearTimeout(timer);
            if (stopped || !live || document.hidden) {
                return;
            }
            timer = window.setTimeout(() => void load(), 2000);
        }

        async function load() {
            if (stopped || document.hidden) {
                return;
            }
            try {
                const response = await fetch("/api/recalc/journal", { signal: controller.signal, cache: "no-store" });
                const json = (await response.json()) as ApiResponse<BasketRecalcRun[]>;
                if (!stopped && json.success) {
                    setEvents((current) => sameEvents(current, json.data) ? current : json.data);
                    const nextPlan = syncRecalcPlan(json.data);
                    const running = json.data.some((event) => event.status === "running");
                    live = nextPlan !== null || running;
                    arm();
                    return;
                }
            } catch {
                if (controller.signal.aborted || stopped) {
                    return;
                }
            }
            arm();
        }

        function onVisible() {
            if (!document.hidden) {
                void load();
            }
        }

        document.addEventListener("visibilitychange", onVisible);
        void load();
        return () => {
            stopped = true;
            controller.abort();
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [open, plan]);

    const startedToday = (plan !== null) || events.length > 0;
    if (!canOpenJournal && !startedToday && !open) {
        return null;
    }

    const label = status === "idle" ? "Журнал пересчёта" : STATUS_LABEL[status];

    return (
        <>
            <Button
                ref={buttonRef}
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn("relative transition-transform duration-300", landed && "scale-125")}
                aria-label={label}
                title={label}
                onClick={() => {
                    closing.current = false;
                    setOpen(true);
                }}
            >
                <ListChecksIcon />
                <StatusMark status={status} />
            </Button>
            {open ? (
                <Dialog
                    open
                    onOpenChange={(next) => {
                        if (next) {
                            closing.current = false;
                            setOpen(true);
                            return;
                        }
                        collapse();
                    }}
                >
                    <DialogContent
                        ref={popupRef}
                        showCloseButton={false}
                        data-recalc-journal=""
                        className="flex h-[min(70vh,40rem)] flex-col gap-4 data-closed:animate-none! sm:max-w-3xl"
                    >
                        <DialogHeader className="flex-row items-center gap-1 pr-28">
                            <DialogTitle>Журнал пересчёта</DialogTitle>
                            {canOpenJournal ? (
                                <Link
                                    href="/admin/monitoring?tab=journal"
                                    className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0")}
                                    aria-label="Журнал мониторинга"
                                    title="Журнал мониторинга"
                                    onClick={() => setOpen(false)}
                                >
                                    <ActivityIcon />
                                </Link>
                            ) : null}
                            <Button type="button" variant="ghost" size="sm" className="absolute top-3 right-3" onClick={collapse}>
                                <Minimize2Icon />
                                Свернуть
                            </Button>
                        </DialogHeader>
                        <RecalcJournalLog events={events} plan={plan} />
                    </DialogContent>
                </Dialog>
            ) : null}
        </>
    );
}

function StatusMark({ status }: { status: RecalcConsoleStatus }) {
    if (status === "idle") {
        return null;
    }
    const className = "absolute -top-1.5 -right-1.5 size-4 rounded-full bg-background";
    if (status === "running") {
        return <LoaderCircleIcon aria-hidden="true" className={`${className} animate-spin text-primary`} />;
    }
    if (status === "pending") {
        return <CircleIcon aria-hidden="true" className={`${className} text-muted-foreground`} />;
    }
    if (status === "failed") {
        return <CircleXIcon aria-hidden="true" className={`${className} text-destructive`} />;
    }
    return <CircleCheckIcon aria-hidden="true" className={`${className} text-primary`} />;
}

function sameEvents(left: BasketRecalcRun[], right: BasketRecalcRun[]): boolean {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((event, index) => {
        const other = right[index];
        return event.id === other.id
            && event.status === other.status
            && event.finishedAt === other.finishedAt
            && event.lines === other.lines
            && event.error === other.error;
    });
}
