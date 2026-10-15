"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PeriodBadge } from "./PeriodBadge";

export type PeriodHintTone = "loading" | "future" | "closed" | "current" | "past";

const HINT_TRIGGER: Record<PeriodHintTone, string> = {
    loading: "border-amber-500 bg-amber-400 text-amber-950",
    future: "border-amber-600 bg-amber-400 text-amber-950",
    closed: "border-rose-600 bg-rose-500 text-white",
    current: "border-emerald-600 bg-emerald-500 text-white",
    past: "border-border bg-muted text-foreground",
};

const HINT_POPUP: Record<PeriodHintTone, string> = {
    loading: "border-amber-500 bg-amber-400 text-amber-950 ring-amber-600",
    future: "border-amber-500 bg-amber-400 text-amber-950 ring-amber-600",
    closed: "border-rose-600 bg-rose-600 text-white ring-rose-700",
    current: "border-emerald-600 bg-emerald-600 text-white ring-emerald-700",
    past: "border-border bg-popover text-popover-foreground ring-border",
};

export function RrsPeriodControls({
    period,
    appliedPeriod,
    savedPeriods,
    disabled,
    onPeriodChange,
    hint,
}: {
    period: string;
    appliedPeriod: string | null;
    savedPeriods: { period: string }[];
    disabled?: boolean;
    onPeriodChange: (period: string) => void;
    hint: { text: string; tone: PeriodHintTone };
}) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (hint.tone === "current" || hint.tone === "past") {
            return;
        }
        setOpen(true);
    }, [hint.text, hint.tone]);

    return (
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Период</span>
                <Input
                    type="month"
                    aria-label="Период"
                    value={period.slice(0, 7)}
                    disabled={disabled}
                    className="h-8 w-40 px-2"
                    onChange={(event) => {
                        const month = event.target.value;
                        if (!month || disabled) {
                            return;
                        }
                        onPeriodChange(`${month}-01`);
                    }}
                />
            </label>
            <PeriodBadge period={period} appliedPeriod={appliedPeriod} savedPeriods={savedPeriods} />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    type="button"
                    aria-label="Пояснение к периоду"
                    className={cn(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border shadow-sm outline-none",
                        HINT_TRIGGER[hint.tone],
                        (hint.tone === "loading" || (open && hint.tone !== "current" && hint.tone !== "past")) && "animate-pulse",
                    )}
                >
                    <Info className="size-4" />
                </PopoverTrigger>
                <PopoverContent side="bottom" align="start" className={cn("w-[min(20rem,calc(100vw-1.5rem))] gap-1 p-3 shadow-lg", HINT_POPUP[hint.tone])}>
                    <p className="text-sm font-medium leading-snug">{hint.text}</p>
                </PopoverContent>
            </Popover>
        </div>
    );
}
