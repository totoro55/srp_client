"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmployeeMovement } from "./mock";

const LABEL: Record<EmployeeMovement, string> = {
    dismissed: "уволен",
    transferred: "переведен",
    absent: "отсутствие",
    title: "смена должности",
};

export function movementLabel(movement: EmployeeMovement, on?: string | null): string {
    const day = formatDayMonth(on);
    return day ? `${LABEL[movement]} ${day}` : LABEL[movement];
}

function formatDayMonth(value: string | null | undefined): string {
    if (!value) {
        return "";
    }
    const [, month, day] = value.split("-");
    if (!month || !day) {
        return "";
    }
    return `${day}.${month}`;
}

function shortRange(from: string, until: string): string {
    return `${formatDayMonth(from)}–${formatDayMonth(until)}`;
}

export function movementNameClass(movement: EmployeeMovement | undefined): string | undefined {
    if (movement === "dismissed") {
        return "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50";
    }
    if (movement === "transferred") {
        return "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50";
    }
    if (movement === "absent") {
        return "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100";
    }
    return undefined;
}

export function movementValueClass(movement: EmployeeMovement | undefined): string | undefined {
    if (movement === "dismissed") {
        return "text-rose-700 dark:text-rose-300";
    }
    if (movement === "transferred") {
        return "text-amber-800 dark:text-amber-300";
    }
    if (movement === "absent") {
        return "text-slate-700 dark:text-slate-300";
    }
    return undefined;
}

function movementMetaClass(movement: EmployeeMovement | undefined): string {
    if (movement === "dismissed") {
        return "text-rose-800 dark:text-rose-200";
    }
    if (movement === "transferred") {
        return "text-amber-900 dark:text-amber-200";
    }
    if (movement === "absent") {
        return "text-slate-700 dark:text-slate-300";
    }
    if (movement === "title") {
        return "text-violet-800 dark:text-violet-200";
    }
    return "text-muted-foreground";
}

export function employeeStatusText(input: {
    movement?: EmployeeMovement;
    movementOn?: string | null;
    partial?: boolean;
    from?: string;
    until?: string;
}): string {
    const status = input.movement ? movementLabel(input.movement, input.partial ? null : input.movementOn) : "";
    const range = input.partial && input.from && input.until ? shortRange(input.from, input.until) : "";
    return [status, range].filter(Boolean).join(" · ");
}

export function EmployeeStatusNote({
    className,
    ...input
}: {
    movement?: EmployeeMovement;
    movementOn?: string | null;
    partial?: boolean;
    from?: string;
    until?: string;
    className?: string;
}) {
    const text = employeeStatusText(input);
    if (!text) {
        return null;
    }
    return <span className={cn("block truncate text-[11px] leading-tight font-normal", movementMetaClass(input.movement), className)}>{text}</span>;
}

export function EmployeeNameLine({
    name,
    spoiler = true,
    fit = false,
    ...input
}: {
    name: string;
    movement?: EmployeeMovement;
    movementOn?: string | null;
    partial?: boolean;
    from?: string;
    until?: string;
    spoiler?: boolean;
    fit?: boolean;
}) {
    const text = employeeStatusText(input);
    const [open, setOpen] = useState(false);
    const nameClass = fit ? "whitespace-nowrap" : "truncate";
    if (!text || !spoiler) {
        return <span className={cn("block", nameClass)}>{name}</span>;
    }
    return (
        <span className={cn("block", fit ? "w-max" : "min-w-0")}>
            <span className={cn("flex items-center gap-0.5", fit ? "w-max" : "min-w-0")}>
                <span className={nameClass}>{name}</span>
                <button
                    type="button"
                    aria-expanded={open}
                    aria-label={open ? "Скрыть статус" : "Показать статус"}
                    className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10", movementMetaClass(input.movement))}
                    onClick={(event) => {
                        event.stopPropagation();
                        setOpen((current) => !current);
                    }}
                >
                    <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
                </button>
            </span>
            {open ? <EmployeeStatusNote {...input} className={cn("mt-0.5", fit && "w-0 min-w-full")} /> : null}
        </span>
    );
}
