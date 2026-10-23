'use client';

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LookupSkeleton } from "@/components/loading-state";

interface PositionOption {
    title: string;
    count: number;
}

type CardStatus = "idle" | "loading" | "ready" | "error";

export function PositionCard({ title }: { title: string }) {
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState<number | null>(null);
    const [status, setStatus] = useState<CardStatus>("idle");
    const needle = title.trim().toLowerCase();

    useEffect(() => {
        setCount(null);
        setStatus("idle");
    }, [needle]);

    useEffect(() => {
        if (!open || !needle) return;
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            void fetch("/api/admin/available-positions", { signal: controller.signal })
                .then((response) => response.json())
                .then((json: { success?: boolean; data?: PositionOption[] }) => {
                    if (!json.success || !json.data) {
                        setCount(null);
                        setStatus("error");
                        return;
                    }
                    const found = json.data.find((item) => item.title.trim().toLowerCase() === needle);
                    setCount(found ? Number(found.count) : 0);
                    setStatus("ready");
                })
                .catch((error: unknown) => {
                    if (error instanceof DOMException && error.name === "AbortError") return;
                    setCount(null);
                    setStatus("error");
                });
        }, 0);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [open, needle]);

    return (
        <Popover open={open} onOpenChange={(next) => {
            setOpen(next);
            if (next) setStatus((current) => current === "ready" ? current : "loading");
        }}>
            <PopoverTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Сотрудники на должности ${title}`} />}
            >
                <Info />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 gap-2 p-3">
                {status === "loading" || status === "idle" ? <LookupSkeleton rows={1} lines={1} /> : null}
                {status === "error" ? <p className="text-sm text-muted-foreground">Не удалось открыть данные должности</p> : null}
                {status === "ready" && count !== null ? (
                    <p className="text-sm">
                        <span className="text-muted-foreground">Количество сотрудников в должности: </span>
                        {count}
                    </p>
                ) : null}
            </PopoverContent>
        </Popover>
    );
}
