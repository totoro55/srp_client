import { Badge } from "@/components/ui/badge";
import type { Ktu } from "./mock";

export function KtuMark({ ktu }: { ktu: Ktu }) {
    const plus = ktu === "plus";
    return (
        <Badge
            variant="outline"
            className={plus
                ? "h-6 border-emerald-700/15 bg-emerald-600 px-2.5 font-semibold text-white dark:border-emerald-300/20 dark:bg-emerald-500 dark:text-emerald-950"
                : "h-6 border-rose-700/15 bg-rose-600 px-2.5 font-semibold text-white dark:border-rose-300/20 dark:bg-rose-500 dark:text-rose-950"}
        >
            {plus ? "КТУ+" : "КТУ−"}
        </Badge>
    );
}
