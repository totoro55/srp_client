import { Clock, Inbox, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedbackCounts } from "@/services/feedback";

const STAFF = [
    { key: "unread", label: "Непрочитанные", icon: Mail },
    { key: "unprocessed", label: "Не обработанные", icon: Inbox },
    { key: "progress", label: "В работе", icon: Clock },
] as const;

const USER = [
    { key: "unread", label: "Непрочитанные", icon: Mail },
    { key: "progress", label: "В работе", icon: Clock },
] as const;

const HOME = [
    { key: "unprocessed", label: "Новые обращения", icon: Inbox },
    { key: "unread", label: "Непрочитанные ответы", icon: Mail },
] as const;

export function FeedbackCountBadges({
    counts,
    processor,
    size = "sm",
    home = false,
}: {
    counts: FeedbackCounts;
    processor: boolean;
    size?: "sm" | "md" | "icon";
    home?: boolean;
}) {
    const items = home ? HOME : processor ? STAFF : USER;
    const icon = size === "icon";
    const large = size === "md";
    return (
        <span className={cn("inline-flex flex-wrap items-center", large ? "gap-2" : "gap-1.5")}>
            {items.map((item) => {
                const value = counts[item.key];
                const Icon = item.icon;
                return (
                    <span
                        key={item.key}
                        title={item.label}
                        className={cn(
                            "inline-flex items-center rounded-full bg-muted text-muted-foreground",
                            icon && "h-5 gap-1 px-1.5 text-xs",
                            large && "h-8 gap-1.5 px-3 text-sm",
                            !icon && !large && "h-5 gap-1 px-2 text-xs",
                        )}
                    >
                        {icon ? <Icon className="size-3" aria-hidden /> : null}
                        <span className="sr-only">{item.label}: </span>
                        <span className={cn("font-medium tabular-nums text-foreground", value > 0 && "text-primary")}>{value}</span>
                        {icon ? null : item.label}
                    </span>
                );
            })}
        </span>
    );
}
