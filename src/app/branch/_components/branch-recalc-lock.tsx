"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTheme } from "next-themes";
import type { BasketUpdateKind } from "@/services/basket-updates";
import { cn } from "@/lib/utils";

interface BranchRecalcLockValue {
    locked: boolean;
    kinds: BasketUpdateKind[];
}

const BranchRecalcLockContext = createContext<BranchRecalcLockValue>({ locked: false, kinds: [] });

const IDLE_MS = 4_000;
const BUSY_MS = 2_000;

export function useBranchRecalcLock(): BranchRecalcLockValue {
    return useContext(BranchRecalcLockContext);
}

export function BranchRecalcLockProvider({
    branchId,
    period,
    children,
}: {
    branchId: string;
    period: string;
    children: ReactNode;
}) {
    const [locked, setLocked] = useState(false);
    const [kinds, setKinds] = useState<BasketUpdateKind[]>([]);

    useEffect(() => {
        if (!branchId || !period) {
            setLocked(false);
            setKinds([]);
            return;
        }
        let cancelled = false;
        let timer = 0;

        async function poll() {
            if (document.hidden) {
                timer = window.setTimeout(poll, IDLE_MS);
                return;
            }
            try {
                const response = await fetch(
                    `/api/branch/recalc-status?branch=${encodeURIComponent(branchId)}&period=${encodeURIComponent(period)}`,
                    { cache: "no-store" },
                );
                const body = await response.json().catch(() => null) as {
                    success?: boolean;
                    data?: { locked?: boolean; kinds?: BasketUpdateKind[] };
                } | null;
                if (cancelled) {
                    return;
                }
                const nextLocked = Boolean(body?.success && body.data?.locked);
                const nextKinds = Array.isArray(body?.data?.kinds) ? body.data.kinds : [];
                setLocked(nextLocked);
                setKinds(nextKinds);
                timer = window.setTimeout(poll, nextLocked ? BUSY_MS : IDLE_MS);
            } catch {
                if (!cancelled) {
                    timer = window.setTimeout(poll, IDLE_MS);
                }
            }
        }

        void poll();
        function onVisibility() {
            if (!document.hidden) {
                window.clearTimeout(timer);
                void poll();
            }
        }
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [branchId, period]);

    return (
        <BranchRecalcLockContext.Provider value={{ locked, kinds }}>
            {children}
        </BranchRecalcLockContext.Provider>
    );
}

export function BranchRecalcOverlay({ className }: { className?: string }) {
    const { locked } = useBranchRecalcLock();
    if (!locked) {
        return null;
    }
    return (
        <>
            <div
                className={cn("absolute inset-0 z-50 bg-background/55 backdrop-blur-[6px]", className)}
                aria-hidden
            />
            <div
                className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4"
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <div className="pointer-events-auto flex w-max min-w-[18rem] max-w-[min(28rem,calc(100%-2rem))] flex-col items-center gap-3 rounded-xl border bg-background/95 px-6 py-5 text-center shadow-sm sm:min-w-[20rem]">
                    <p className="text-base font-medium">Идёт расчёт премии</p>
                    <RecalcAlienVideo />
                    <p className="text-sm text-muted-foreground">Пожалуйста, дождитесь окончания расчёта</p>
                </div>
            </div>
        </>
    );
}

function RecalcAlienVideo() {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);
    const dark = mounted && resolvedTheme === "dark";
    const src = dark ? "/recalc-alien-dark" : "/recalc-alien-light";
    return (
        <video
            key={src}
            className="h-36 w-auto select-none rounded-md sm:h-40"
            width={480}
            height={624}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            aria-hidden
        >
            <source src={`${src}.webm`} type="video/webm" />
            <source src={`${src}.mp4`} type="video/mp4" />
        </video>
    );
}
