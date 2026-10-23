"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, UserCheck, UserPlus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LookupSkeleton } from "@/components/loading-state";
import { FEEDBACK_STATUS_LABELS, FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/content";
import { FeedbackStatusIcon } from "./FeedbackStatusBadge";
import { cn } from "@/lib/utils";
import { useAccess } from "@/hooks/useAccess";
import { ApiResponse } from "@/types/api";

interface Assignee {
    login: string;
    name: string;
}

export type FeedbackDraft =
    | { kind: "status"; status: FeedbackStatus }
    | { kind: "take" }
    | { kind: "assign"; login: string; name: string };

const menuActionClass = "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

export function FeedbackStatusMenu({
    status,
    draft,
    assignee,
    disabled,
    className,
    onDraft,
}: {
    status: FeedbackStatus;
    draft: FeedbackDraft | null;
    assignee: string | null;
    disabled: boolean;
    className?: string;
    onDraft: (draft: FeedbackDraft | null) => void;
}) {
    const access = useAccess();
    const [open, setOpen] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [query, setQuery] = useState("");
    const [assignees, setAssignees] = useState<Assignee[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const taken = status === "progress" && assignee?.toLowerCase() === access.username?.toLowerCase();
    const shownStatus = draft?.kind === "status" ? draft.status : draft ? "progress" : status;

    useEffect(() => {
        if (!assigning) {
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams();
            const search = query.trim();
            if (search) {
                params.set("q", search);
            }
            void fetch(`/api/feedback/assignees?${params.toString()}`, { signal: controller.signal })
                .then(async (response) => {
                    const json = (await response.json()) as ApiResponse<Assignee[]>;
                    if (!json.success) {
                        setError(json.error.message);
                        return;
                    }
                    setError(null);
                    setAssignees(json.data);
                })
                .catch((reason: unknown) => {
                    if (reason instanceof DOMException && reason.name === "AbortError") {
                        return;
                    }
                    setError("Не удалось найти сотрудников");
                });
        }, 300);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [assigning, query]);

    function closeAssigning() {
        setAssigning(false);
        setQuery("");
        setAssignees(null);
        setError(null);
    }

    return (
        <DropdownMenu open={open} onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
                closeAssigning();
            }
        }}>
            <DropdownMenuTrigger
                type="button"
                aria-label={draft ? `Изменение в сообщении: ${FEEDBACK_STATUS_LABELS[shownStatus]}` : `Статус: ${FEEDBACK_STATUS_LABELS[status]}`}
                className={cn(
                    buttonVariants({ variant: "outline", size: "icon-sm" }),
                    "rounded-full",
                    draft && "border-sky-600 text-sky-700",
                    className,
                )}
                disabled={disabled}
            >
                <FeedbackStatusIcon status={shownStatus} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="min-w-56">
                {assigning ? (
                    <div className="flex flex-col gap-1">
                        <button type="button" className={menuActionClass} onClick={closeAssigning}>
                            <ChevronLeft />
                            К статусам
                        </button>
                        <Input
                            value={query}
                            placeholder="Имя или логин"
                            aria-label="Сотрудник"
                            className="h-8"
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                        />
                        <div className="max-h-48 overflow-y-auto">
                            {assignees === null && error === null ? <LookupSkeleton rows={3} lines={1} /> : null}
                            {error ? <p className="px-2 py-1.5 text-sm text-destructive">{error}</p> : null}
                            {assignees && assignees.length === 0 ? (
                                <p className="px-2 py-1.5 text-sm text-muted-foreground">Никого не найдено</p>
                            ) : null}
                            {assignees?.map((person) => (
                                <DropdownMenuItem
                                    key={person.login}
                                    onClick={() => onDraft({ kind: "assign", login: person.login, name: person.name })}
                                >
                                    <UserPlus />
                                    <span className="min-w-0 wrap-break-word">{person.name}</span>
                                </DropdownMenuItem>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        <DropdownMenuItem disabled={taken || draft?.kind === "take"} onClick={() => onDraft({ kind: "take" })}>
                            <UserCheck />
                            Взять в работу
                        </DropdownMenuItem>
                        <button type="button" className={menuActionClass} onClick={() => setAssigning(true)}>
                            <UserPlus />
                            Назначить сотрудника
                        </button>
                        <DropdownMenuSeparator />
                        {FEEDBACK_STATUSES.map((item) => (
                            <DropdownMenuItem
                                key={item}
                                variant={item === "declined" ? "destructive" : "default"}
                                disabled={shownStatus === item && (draft === null || draft.kind === "status")}
                                onClick={() => onDraft(item === status ? null : { kind: "status", status: item })}
                            >
                                <FeedbackStatusIcon status={item} />
                                {FEEDBACK_STATUS_LABELS[item]}
                            </DropdownMenuItem>
                        ))}
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
