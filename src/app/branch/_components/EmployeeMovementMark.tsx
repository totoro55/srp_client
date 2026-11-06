import { cn } from "@/lib/utils";
import type { EmployeeMovement } from "./mock";
import { formatSegmentRange } from "./staff";

const LABEL: Record<EmployeeMovement, string> = {
    dismissed: "уволен",
    transferred: "переведен",
    absent: "отсутствие",
    title: "смена должности",
};

export function movementLabel(movement: EmployeeMovement, on?: string | null): string {
    const day = formatDayMonth(on);
    return day ? `(${LABEL[movement]} ${day})` : `(${LABEL[movement]})`;
}

function formatDayMonth(value: string | null | undefined): string {
    if (!value) {
        return "";
    }
    const [, month, day] = value.split("-");
    if (!month || !day) {
        return "";
    }
    return `${day}/${month}`;
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

export function EmployeeNameLine({
    name,
    movement,
    movementOn = null,
    markClassName,
    markAtEnd = false,
}: {
    name: string;
    movement?: EmployeeMovement;
    movementOn?: string | null;
    markClassName?: string;
    markAtEnd?: boolean;
}) {
    return (
        <span className={cn("flex min-w-0 items-center gap-x-1.5", markAtEnd ? "w-full flex-nowrap" : "max-w-full flex-wrap gap-y-0.5")}>
            <span className={cn("truncate", markAtEnd ? "min-w-0" : "max-w-full shrink-0")}>{name}</span>
            {movement ? <EmployeeMovementMark movement={movement} on={movementOn} className={cn(markAtEnd && "ml-auto", markClassName)} /> : null}
        </span>
    );
}

export function StaffSegmentNote({
    partial,
    from,
    until,
}: {
    partial: boolean;
    from: string;
    until: string;
}) {
    if (!partial) {
        return null;
    }
    return (
        <span className="text-[10px] leading-tight font-normal text-muted-foreground">
            {formatSegmentRange(from, until)}
        </span>
    );
}

export function EmployeeMovementMark({
    movement,
    on = null,
    className,
}: {
    movement: EmployeeMovement;
    on?: string | null;
    className?: string;
}) {
    const tone = movement === "dismissed"
        ? "bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950"
        : movement === "absent"
            ? "bg-slate-600 text-white dark:bg-slate-400 dark:text-slate-950"
            : movement === "title"
                ? "bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950"
                : "bg-amber-500 text-amber-950 dark:bg-amber-400";
    return (
        <span
            className={cn(
                "inline-flex shrink-0 rounded px-1 py-px text-[10px] leading-tight font-semibold",
                tone,
                className,
            )}
        >
            {movementLabel(movement, on)}
        </span>
    );
}
