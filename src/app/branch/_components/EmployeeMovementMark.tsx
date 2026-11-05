import { cn } from "@/lib/utils";
import type { EmployeeMovement } from "./mock";

const LABEL: Record<EmployeeMovement, string> = {
    dismissed: "Уволен",
    transferred: "Переведён",
};

export function movementLabel(movement: EmployeeMovement): string {
    return LABEL[movement];
}

export function movementNameClass(movement: EmployeeMovement | undefined): string | undefined {
    if (movement === "dismissed") {
        return "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-50";
    }
    if (movement === "transferred") {
        return "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-50";
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
    return undefined;
}

export function EmployeeNameLine({
    name,
    movement,
    markClassName,
    markAtEnd = false,
}: {
    name: string;
    movement?: EmployeeMovement;
    markClassName?: string;
    markAtEnd?: boolean;
}) {
    return (
        <span className={cn("flex min-w-0 items-center gap-x-1.5", markAtEnd ? "w-full flex-nowrap" : "max-w-full flex-wrap gap-y-0.5")}>
            <span className={cn("truncate", markAtEnd ? "min-w-0" : "max-w-full shrink-0")}>{name}</span>
            {movement ? <EmployeeMovementMark movement={movement} className={cn(markAtEnd && "ml-auto", markClassName)} /> : null}
        </span>
    );
}

export function EmployeeMovementMark({ movement, className }: { movement: EmployeeMovement; className?: string }) {
    const dismissed = movement === "dismissed";
    return (
        <span
            className={cn(
                "inline-flex shrink-0 rounded px-1 py-px text-[10px] leading-tight font-semibold",
                dismissed
                    ? "bg-rose-600 text-white dark:bg-rose-500 dark:text-rose-950"
                    : "bg-amber-500 text-amber-950 dark:bg-amber-400",
                className,
            )}
        >
            {LABEL[movement]}
        </span>
    );
}
