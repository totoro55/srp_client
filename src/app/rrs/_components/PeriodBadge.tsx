import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { describePeriodEffect, type PeriodEffectKind } from "./model";

const PERIOD_BADGE_CLASS: Record<PeriodEffectKind, string> = {
    current: "border-emerald-600/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    future: "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    past: "border-border bg-muted text-muted-foreground",
};

export function PeriodBadge({
    period,
    appliedPeriod,
    savedPeriods,
}: {
    period: string;
    appliedPeriod: string | null;
    savedPeriods: { period: string }[];
}) {
    const effect = describePeriodEffect({ period, appliedPeriod, savedPeriods });
    return (
        <Badge variant="outline" className={cn("h-auto min-h-8 max-w-full shrink gap-x-1.5 gap-y-0.5 whitespace-normal px-2.5 py-1 font-normal", PERIOD_BADGE_CLASS[effect.kind])}>
            <span className="font-medium">{effect.title}</span>
            <span className="min-w-0">{effect.detail}</span>
        </Badge>
    );
}
