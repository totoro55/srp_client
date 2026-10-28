"use client";

import { type RefObject, type ReactNode } from "react";
import { ArrowDown, Pencil, Trash2, UserCheck, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FeedbackFileLinks } from "./FeedbackFileList";
import { FeedbackStatusIcon } from "./FeedbackStatusBadge";
import type { FeedbackDialogColor } from "./FeedbackDialogColor";
import { entrySpace, type SystemNote, type ThreadEntry, type TicketFile } from "./feedback-model";
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/lib/content";
import { cn } from "@/lib/utils";

export function FeedbackMessageList({
    entries,
    color,
    canProcess,
    closed,
    declined,
    scrollEdges,
    unseenCount,
    threadRef,
    onScroll,
    onScrollDown,
    onEdit,
    onDelete,
}: {
    entries: ThreadEntry[];
    color: FeedbackDialogColor;
    canProcess: boolean;
    closed: boolean;
    declined: boolean;
    scrollEdges: { top: boolean; bottom: boolean };
    unseenCount: number;
    threadRef: RefObject<HTMLDivElement | null>;
    onScroll: () => void;
    onScrollDown: () => void;
    onEdit: (target: { messageId: number | null; text: string; source: string; files: TicketFile[] }) => void;
    onDelete: (messageId: number) => void;
}) {
    return (
        <div className="relative min-h-0 flex-1">
            <div ref={threadRef} onScroll={onScroll} className="absolute inset-0 flex flex-col overflow-x-hidden overflow-y-auto overscroll-contain">
                {entries.map((entry, index) => (
                    <div key={entry.key} className={entrySpace(entry, entries[index - 1])}>
                        {entry.kind === "fresh" ? (
                            <Marker variant="separator" className="before:hidden">
                                <MarkerContent>Новые сообщения</MarkerContent>
                            </Marker>
                        ) : null}
                        {entry.kind === "system" ? (
                            <MessageActions
                                enabled={canProcess && entry.mine && entry.messageId !== null}
                                onEdit={() => onEdit({ messageId: entry.messageId, text: entry.text, source: entry.source, files: [] })}
                                onDelete={() => {
                                    if (entry.messageId !== null) {
                                        onDelete(entry.messageId);
                                    }
                                }}
                            >
                                <SystemMarker note={entry.note} createdAt={entry.createdAt} />
                            </MessageActions>
                        ) : null}
                        {entry.kind === "bubble" ? (
                            <MessageActions
                                enabled={canProcess && entry.mine && entry.messageId !== null}
                                onEdit={() => onEdit({ messageId: entry.messageId, text: entry.text, source: entry.source, files: entry.files })}
                                onDelete={() => {
                                    if (entry.messageId !== null) {
                                        onDelete(entry.messageId);
                                    }
                                }}
                            >
                                <ChatBubble
                                    mine={entry.mine}
                                    authorName={entry.authorName}
                                    body={entry.body}
                                    createdAt={entry.createdAt}
                                    editedAt={entry.editedAt}
                                    files={entry.files}
                                    color={color}
                                    continued={entry.continued}
                                    tail={entry.tail}
                                />
                            </MessageActions>
                        ) : null}
                    </div>
                ))}
                {closed ? (
                    <p className="mt-3 text-center text-xs text-muted-foreground">
                        {declined ? "Обращение отклонено." : "Обращение завершено."}
                    </p>
                ) : null}
            </div>
            <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-background to-transparent transition-opacity md:from-card", scrollEdges.top ? "opacity-100" : "opacity-0")} />
            <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent transition-opacity md:from-card", scrollEdges.bottom ? "opacity-100" : "opacity-0")} />
            {scrollEdges.bottom ? (
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="absolute right-3 bottom-3 z-10 rounded-full bg-background shadow-md"
                    aria-label={unseenCount > 0 ? `Прокрутить вниз, новых сообщений: ${unseenCount}` : "Прокрутить вниз"}
                    onClick={onScrollDown}
                >
                    <ArrowDown />
                    {unseenCount > 0 ? (
                        <Badge className="absolute -top-2 -right-2 min-w-5 px-1">{unseenCount}</Badge>
                    ) : null}
                </Button>
            ) : null}
        </div>
    );
}

function statusByLabel(label: string): FeedbackStatus | null {
    const found = (Object.entries(FEEDBACK_STATUS_LABELS) as [FeedbackStatus, string][]).find(([, value]) => value === label);
    return found?.[0] ?? null;
}

function SystemMarker({ note, createdAt }: { note: SystemNote; createdAt: string }) {
    const when = new Date(createdAt).toLocaleString("ru-RU");
    const status = note.kind === "status" ? statusByLabel(note.detail) : null;
    const text = note.kind === "take"
        ? "Обращение взято в работу"
        : note.kind === "assign"
            ? `Назначен ответственный: ${note.detail}`
            : `Статус: ${note.detail}`;
    return (
        <Marker>
            {note.kind === "take" || note.kind === "assign" || status ? (
                <MarkerIcon>
                    {note.kind === "take" ? <UserCheck /> : note.kind === "assign" ? <UserPlus /> : status ? <FeedbackStatusIcon status={status} /> : null}
                </MarkerIcon>
            ) : null}
            <MarkerContent>{`${text} · ${when}`}</MarkerContent>
        </Marker>
    );
}

function EditedMark({ editedAt }: { editedAt: string }) {
    const when = new Date(editedAt).toLocaleString("ru-RU");
    return (
        <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="inline-flex shrink-0" />}>
                <Pencil className="size-3" aria-hidden />
                <span className="sr-only">Изменено {when}</span>
            </TooltipTrigger>
            <TooltipContent>Изменено {when}</TooltipContent>
        </Tooltip>
    );
}

function ChatBubble({
    mine,
    authorName,
    body,
    createdAt,
    editedAt,
    files,
    color,
    continued,
    tail,
}: {
    mine: boolean;
    authorName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    files: TicketFile[];
    color: FeedbackDialogColor;
    continued: boolean;
    tail: boolean;
}) {
    return (
        <div className={cn("flex w-full", mine ? "justify-end pr-2" : "justify-start pl-2")}>
            <div
                className={cn(
                    "relative flex min-w-0 max-w-[85%] flex-col gap-1 px-3 py-2",
                    bubbleShape(mine, continued, tail),
                    files.length > 0 ? "w-full" : "w-fit",
                    mine ? color.mine : color.theirs,
                )}
            >
                {continued ? null : (
                    <p className={cn("truncate text-xs font-medium leading-tight", mine ? "text-right" : "text-left")} title={authorName}>
                        {authorName}
                    </p>
                )}
                {body ? <p className="wrap-break-word whitespace-pre-wrap text-sm">{body}</p> : null}
                <FeedbackFileLinks files={files} />
                <p className={cn("flex items-center gap-1 text-[11px] leading-none opacity-70", mine ? "justify-end" : "justify-start")}>
                    {editedAt ? <EditedMark editedAt={editedAt} /> : null}
                    <time dateTime={createdAt}>{new Date(createdAt).toLocaleString("ru-RU")}</time>
                </p>
                {tail ? (
                    <span
                        aria-hidden
                        className={cn(
                            "absolute bottom-0 size-2 bg-inherit",
                            mine
                                ? "-right-1.5 [clip-path:polygon(0_0,0_100%,100%_100%)]"
                                : "-left-1.5 [clip-path:polygon(100%_0,0_100%,100%_100%)]",
                        )}
                    />
                ) : null}
            </div>
        </div>
    );
}

function bubbleShape(mine: boolean, continued: boolean, tail: boolean): string {
    if (mine) {
        return cn(
            "rounded-tl-3xl rounded-bl-3xl",
            continued ? "rounded-tr-[6px]" : "rounded-tr-3xl",
            tail ? "rounded-br-none" : "rounded-br-[6px]",
        );
    }
    return cn(
        "rounded-tr-3xl rounded-br-3xl",
        continued ? "rounded-tl-[6px]" : "rounded-tl-3xl",
        tail ? "rounded-bl-none" : "rounded-bl-[6px]",
    );
}

function MessageActions({
    enabled,
    onEdit,
    onDelete,
    children,
}: {
    enabled: boolean;
    onEdit: () => void;
    onDelete: () => void;
    children: ReactNode;
}) {
    if (!enabled) {
        return children;
    }
    return (
        <ContextMenu>
            <ContextMenuTrigger className="block w-full select-text!">
                {children}
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem onClick={onEdit}>
                    <Pencil />
                    Изменить
                </ContextMenuItem>
                <ContextMenuItem variant="destructive" onClick={onDelete}>
                    <Trash2 />
                    Удалить
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}
