import { CircleCheck, CircleDot, CircleX, MessageCircle, Play, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/lib/content";

const STATUS_ICON: Record<FeedbackStatus, LucideIcon> = {
    new: CircleDot,
    progress: Play,
    waiting: MessageCircle,
    done: CircleCheck,
    declined: CircleX,
};

export function FeedbackStatusIcon({ status }: { status: FeedbackStatus }) {
    const Icon = STATUS_ICON[status];
    return <Icon />;
}

const STATUS_CLASS: Record<FeedbackStatus, string> = {
    new: "border-transparent bg-primary/15 text-primary",
    progress: "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300",
    waiting: "border-transparent bg-sky-500/15 text-sky-800 dark:text-sky-300",
    done: "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
    declined: "border-transparent bg-destructive/10 text-destructive",
};

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
    return (
        <Badge variant="outline" className={STATUS_CLASS[status]}>
            {FEEDBACK_STATUS_LABELS[status]}
        </Badge>
    );
}
