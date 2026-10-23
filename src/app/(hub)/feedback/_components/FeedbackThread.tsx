"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Info, Plus, UserCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageHeading, type PageHeadingCrumb } from "@/app/_components/header/page-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Marker, MarkerContent, MarkerIcon } from "@/components/ui/marker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormAlert } from "@/components/form-alert";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { ButtonSpinner, StackSkeleton } from "@/components/loading-state";
import { FeedbackFileChips, FeedbackFileLinks, useFeedbackFiles } from "./FeedbackFiles";
import { FeedbackDialogColorButton, useFeedbackDialogColor, type FeedbackDialogColor } from "./FeedbackDialogColor";
import { FeedbackStatusBadge, FeedbackStatusIcon } from "./FeedbackStatusBadge";
import { FeedbackStatusMenu, type FeedbackDraft } from "./FeedbackStatusMenu";
import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";

interface TicketFile {
    id: string;
    filename: string;
    sizeBytes: number;
}

interface TicketMessage {
    id: number;
    author: string;
    body: string;
    createdAt: string;
    files: TicketFile[];
}

interface Ticket {
    id: number;
    author: string;
    subject: string;
    body: string;
    status: FeedbackStatus;
    assignee: string | null;
    assigneeName: string | null;
    createdAt: string;
    files: TicketFile[];
    messages: TicketMessage[];
}

interface TicketUpdate {
    changed: boolean;
    status: FeedbackStatus;
    assignee: string | null;
    assigneeName: string | null;
    messages: TicketMessage[];
}

type Pending = "reply";

const POLL_INTERVAL_MS = 4000;

export function FeedbackThread() {
    const params = useParams<{ id: string }>();
    const access = useAccess();
    const canProcess = access.has("feedback:process");
    const dialogColor = useFeedbackDialogColor();
    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [body, setBody] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [pending, setPending] = useState<Pending | null>(null);
    const [scrollEdges, setScrollEdges] = useState({ top: false, bottom: false });
    const [draft, setDraft] = useState<FeedbackDraft | null>(null);
    const [draftLine, setDraftLine] = useState<string | null>(null);
    const [freshAfter, setFreshAfter] = useState<number | null>(null);
    const attachments = useFeedbackFiles(files, pending !== null, setFiles);
    const threadRef = useRef<HTMLDivElement>(null);
    const composerRef = useRef<HTMLTextAreaElement>(null);
    const ticketRef = useRef(ticket);
    const stickToBottom = useRef(true);
    const freshAfterRef = useRef<number | null>(null);
    ticketRef.current = ticket;

    function clearFresh() {
        if (freshAfterRef.current === null) {
            return;
        }
        freshAfterRef.current = null;
        setFreshAfter(null);
    }

    function keepFresh(anchor: number) {
        setFreshAfter((current) => {
            const next = current ?? anchor;
            freshAfterRef.current = next;
            return next;
        });
    }

    function syncScrollEdges() {
        const node = threadRef.current;
        if (!node) {
            return;
        }
        const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;
        const top = node.scrollTop > 4;
        const bottom = remaining > 4;
        stickToBottom.current = remaining < 48;
        if (remaining < 48) {
            clearFresh();
        }
        setScrollEdges((current) => current.top === top && current.bottom === bottom ? current : { top, bottom });
    }

    function scrollDown() {
        const node = threadRef.current;
        if (!node) {
            return;
        }
        stickToBottom.current = true;
        node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }

    useEffect(() => {
        stickToBottom.current = true;
        clearFresh();
        setDraft(null);
        setDraftLine(null);
        const timer = window.setTimeout(() => {
            void load();
        }, 0);
        return () => window.clearTimeout(timer);
    }, [params.id]);

    useEffect(() => {
        const node = threadRef.current;
        if (!node || !ticket) {
            return;
        }
        const pinToBottom = () => {
            if (stickToBottom.current) {
                node.scrollTop = node.scrollHeight;
            }
            syncScrollEdges();
        };
        const onScroll = () => {
            syncScrollEdges();
        };
        pinToBottom();
        const observer = new ResizeObserver(pinToBottom);
        observer.observe(node);
        node.addEventListener("scroll", onScroll);
        return () => {
            observer.disconnect();
            node.removeEventListener("scroll", onScroll);
        };
    }, [ticket?.id, ticket?.messages.length]);

    useEffect(() => {
        if (!loaded) {
            return;
        }
        const ticketId = Number(params.id);
        if (!Number.isInteger(ticketId)) {
            return;
        }
        let stopped = false;
        let timer = 0;
        const controller = new AbortController();

        async function poll() {
            const current = ticketRef.current;
            if (stopped || !current || current.id !== ticketId || document.visibilityState === "hidden") {
                return;
            }
            const query = new URLSearchParams({
                after: String(latestMessageId(current)),
                status: current.status,
                assignee: current.assignee ?? "",
            });
            try {
                const response = await fetch(`/api/feedback/${ticketId}/updates?${query}`, {
                    signal: controller.signal,
                    cache: "no-store",
                });
                const json = (await response.json()) as ApiResponse<TicketUpdate>;
                if (stopped) {
                    return;
                }
                if (!json.success) {
                    if (json.error.code === "NOT_FOUND") {
                        setTicket(null);
                        setError(json.error.message);
                    }
                    return;
                }
                if (!json.data.changed) {
                    return;
                }
                const previous = ticketRef.current;
                if (!previous || previous.id !== ticketId) {
                    return;
                }
                const next = mergeTicket(previous, json.data);
                if (next === previous) {
                    return;
                }
                if (next.messages.length > previous.messages.length && !stickToBottom.current) {
                    keepFresh(latestMessageId(previous));
                }
                setTicket(next);
            } catch {
                // Следующая попытка пойдёт по таймеру. Черновик сообщения не трогаем.
            }
        }

        function arm() {
            window.clearTimeout(timer);
            if (stopped || document.visibilityState === "hidden") {
                return;
            }
            timer = window.setTimeout(() => {
                void poll().finally(arm);
            }, POLL_INTERVAL_MS);
        }

        function onVisibility() {
            if (document.visibilityState === "hidden") {
                window.clearTimeout(timer);
                return;
            }
            void poll().finally(arm);
        }

        document.addEventListener("visibilitychange", onVisibility);
        arm();
        return () => {
            stopped = true;
            controller.abort();
            window.clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibility);
        };
    }, [loaded, params.id]);

    useEffect(() => {
        const element = composerRef.current;
        if (!element) {
            return;
        }
        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
    }, [body]);

    async function load() {
        setError(null);
        try {
            const response = await fetch(`/api/feedback/${params.id}`);
            const json = (await response.json()) as ApiResponse<Ticket>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTicket(json.data);
        } catch {
            setError("Не удалось загрузить обращение");
        } finally {
            setLoaded(true);
        }
    }

    async function send() {
        if (!body.trim()) {
            setError("Напишите сообщение");
            return;
        }
        setPending("reply");
        setError(null);
        try {
            const form = new FormData();
            form.set("body", body);
            if (draft?.kind === "status") {
                form.set("status", draft.status);
            } else if (draft?.kind === "take") {
                form.set("action", "take");
            } else if (draft?.kind === "assign") {
                form.set("action", "assign");
                form.set("assignee", draft.login);
            }
            for (const file of files) {
                form.append("file", file);
            }
            const response = await fetch(`/api/feedback/${params.id}`, { method: "POST", body: form });
            const json = (await response.json()) as ApiResponse<Ticket>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            stickToBottom.current = true;
            clearFresh();
            setTicket(json.data);
            setBody("");
            setFiles([]);
            setDraft(null);
            setDraftLine(null);
            notifySuccess(draft ? "Сообщение отправлено, обращение обновлено" : "Сообщение отправлено");
        } catch {
            setError("Не удалось отправить сообщение");
        } finally {
            setPending(null);
        }
    }

    function chooseDraft(next: FeedbackDraft | null) {
        const text = draftText(next);
        setBody((current) => replaceDraftLine(current, draftLine, text));
        setDraftLine(text);
        setDraft(next);
    }

    function onSubmit(event: FormEvent) {
        event.preventDefault();
        void send();
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
            return;
        }
        if (!body.trim() || pending !== null) {
            return;
        }
        event.preventDefault();
        void send();
    }

    const headingTrail = ticketHeading(params.id, ticket);

    if (!loaded) {
        return (
            <>
                <PageHeading trail={headingTrail} />
                <StackSkeleton />
            </>
        );
    }

    if (!ticket) {
        return (
            <div className="flex flex-col gap-3">
                <PageHeading trail={headingTrail} />
                <FormAlert message={error} />
                <Link href="/feedback" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-fit")}>
                    <ArrowLeft />
                    К списку обращений
                </Link>
            </div>
        );
    }

    const closed = ticket.status === "done" || ticket.status === "declined";
    const mine = (author: string) => author.toLowerCase() === access.username?.toLowerCase();
    const thread = [
        { key: "ticket", id: null as number | null, author: ticket.author, body: ticket.body, createdAt: ticket.createdAt, files: ticket.files },
        ...ticket.messages.map((message) => ({
            key: String(message.id),
            id: message.id as number | null,
            author: message.author,
            body: message.body,
            createdAt: message.createdAt,
            files: message.files,
        })),
    ];
    const freshIndex = freshAfter === null ? -1 : thread.findIndex((item) => item.id !== null && item.id > freshAfter);
    const unseenCount = freshAfter === null ? 0 : ticket.messages.filter((message) => message.id > freshAfter).length;

    return (
        <div className="flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom,0px))] min-h-0 max-w-3xl flex-col max-md:-mx-4 max-md:-my-4 md:h-[calc(100dvh-4rem-3rem)]">
            <PageHeading trail={headingTrail} />
            <Card className="min-h-0 flex-1 rounded-none bg-transparent py-0 shadow-none ring-0 md:rounded-xl md:bg-card md:py-(--card-spacing) md:shadow-xs md:ring-1" size="sm">
                <CardHeader className="flex shrink-0 flex-row items-center gap-2 pt-2 md:pt-0">
                    <Link href="/feedback" aria-label="К списку обращений" className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "shrink-0")}>
                        <ArrowLeft />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                            <FeedbackStatusBadge status={ticket.status} />
                            <DialogMetaButton ticket={ticket} canProcess={canProcess} />
                        </div>
                        <p className="mt-1 hidden wrap-break-word text-xs text-muted-foreground md:block">{dialogMeta(ticket, canProcess)}</p>
                    </div>
                    <div className="ml-auto shrink-0 self-start">
                        <FeedbackDialogColorButton colorId={dialogColor.color.id} onChoose={dialogColor.choose} />
                    </div>
                </CardHeader>
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-2 md:pb-0">
                    <div className="relative min-h-0 flex-1">
                    <div ref={threadRef} onScroll={syncScrollEdges} className="absolute inset-0 flex flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain">
                        {thread.map((message, index) => {
                            const note = systemNote(message.body);
                            const spoken = note ? note.rest : message.body;
                            return (
                                <div key={message.key} className="flex flex-col gap-3">
                                    {index === freshIndex ? (
                                        <Marker variant="separator" className="before:hidden">
                                            <MarkerContent>Новые сообщения</MarkerContent>
                                        </Marker>
                                    ) : null}
                                    {note ? <SystemMarker note={note} createdAt={message.createdAt} /> : null}
                                    {spoken || message.files.length > 0 || !note ? (
                                        <ChatBubble
                                            mine={mine(message.author)}
                                            body={spoken}
                                            createdAt={message.createdAt}
                                            files={message.files}
                                            color={dialogColor.color}
                                        />
                                    ) : null}
                                </div>
                            );
                        })}
                        {closed ? (
                            <p className="text-center text-xs text-muted-foreground">
                                {ticket.status === "declined" ? "Обращение отклонено." : "Обращение завершено."}
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
                            onClick={scrollDown}
                        >
                            <ArrowDown />
                            {unseenCount > 0 ? (
                                <Badge className="absolute -top-2 -right-2 min-w-5 px-1">{unseenCount}</Badge>
                            ) : null}
                        </Button>
                    ) : null}
                    </div>
                    {closed && !canProcess ? null : (
                        <form className="flex shrink-0 flex-col gap-2" onSubmit={onSubmit}>
                            <FormAlert message={error} />
                            <input
                                ref={attachments.inputRef}
                                type="file"
                                multiple
                                accept={attachments.accept}
                                className="sr-only"
                                disabled={!attachments.canAdd}
                                onChange={(event) => {
                                    attachments.addFiles(event.target.files ?? []);
                                    event.target.value = "";
                                }}
                            />
                            <InputGroup
                                className={attachments.dragging && attachments.canAdd ? "border-primary bg-muted/40" : undefined}
                                onDragEnter={attachments.onDragEnter}
                                onDragOver={attachments.onDragOver}
                                onDragLeave={attachments.onDragLeave}
                                onDrop={attachments.onDrop}
                            >
                                {files.length > 0 ? (
                                    <InputGroupAddon align="block-start" className="flex-wrap">
                                        <FeedbackFileChips
                                            files={files}
                                            previews={attachments.previews}
                                            disabled={pending !== null}
                                            onRemove={(index) => setFiles(files.filter((_, item) => item !== index))}
                                        />
                                    </InputGroupAddon>
                                ) : null}
                                <InputGroupTextarea
                                    ref={composerRef}
                                    id="feedback-reply"
                                    aria-label="Сообщение"
                                    placeholder={composerPlaceholder(canProcess, ticket.status)}
                                    className="field-sizing-fixed max-h-32 min-h-12 flex-none overflow-y-auto p-3"
                                    value={body}
                                    disabled={pending !== null}
                                    onChange={(event) => setBody(event.target.value)}
                                    onKeyDown={onKeyDown}
                                />
                                <InputGroupAddon align="block-end" className="flex-wrap">
                                    <InputGroupButton
                                        size="icon-sm"
                                        variant="outline"
                                        className="rounded-full"
                                        aria-label="Приложить файлы"
                                        disabled={!attachments.canAdd}
                                        onClick={() => attachments.inputRef.current?.click()}
                                    >
                                        <Plus />
                                    </InputGroupButton>
                                    {canProcess ? (
                                        <FeedbackStatusMenu
                                            status={ticket.status}
                                            draft={draft}
                                            assignee={ticket.assignee}
                                            disabled={pending !== null}
                                            className="ml-auto"
                                            onDraft={chooseDraft}
                                        />
                                    ) : null}
                                    <InputGroupButton
                                        type="submit"
                                        size="icon-sm"
                                        variant="default"
                                        className={cn("rounded-full", dialogColor.color.send, !canProcess && "ml-auto")}
                                        aria-label="Отправить"
                                        disabled={pending !== null || !body.trim()}
                                    >
                                        {pending === "reply" ? <ButtonSpinner /> : <ArrowUp />}
                                    </InputGroupButton>
                                </InputGroupAddon>
                            </InputGroup>
                            {attachments.ready && attachments.notice ? <p className="text-xs text-destructive">{attachments.notice}</p> : null}
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

interface SystemNote {
    kind: "status" | "take" | "assign";
    detail: string;
    rest: string;
}

function systemNote(body: string): SystemNote | null {
    const take = body.match(/^Обращение взято в работу\.(?:\s+([\s\S]*))?$/);
    if (take) {
        return { kind: "take", detail: "", rest: (take[1] ?? "").trim() };
    }
    const assign = body.match(/^Назначен ответственный: (.+?)\.(?:\s+([\s\S]*))?$/);
    if (assign) {
        return { kind: "assign", detail: assign[1].trim(), rest: (assign[2] ?? "").trim() };
    }
    const status = body.match(/^Статус: (.+?)\.(?:\s+([\s\S]*))?$/);
    if (status) {
        return { kind: "status", detail: status[1].trim(), rest: (status[2] ?? "").trim() };
    }
    return null;
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

function latestMessageId(ticket: Ticket): number {
    return ticket.messages.reduce((max, message) => Math.max(max, message.id), 0);
}

function mergeTicket(current: Ticket, update: TicketUpdate): Ticket {
    const known = new Set(current.messages.map((message) => message.id));
    const extra = update.messages.filter((message) => !known.has(message.id));
    const sameHeader = current.status === update.status
        && current.assignee === update.assignee
        && current.assigneeName === update.assigneeName;
    if (extra.length === 0 && sameHeader) {
        return current;
    }
    return {
        ...current,
        status: update.status,
        assignee: update.assignee,
        assigneeName: update.assigneeName,
        messages: extra.length === 0 ? current.messages : [...current.messages, ...extra].sort((left, right) => left.id - right.id),
    };
}

function ticketHeading(id: string, ticket: Ticket | null): PageHeadingCrumb[] {
    const number = ticket?.id ?? id;
    return [
        {
            href: "/feedback",
            label: "Обратная связь",
            compactLabel: "ОС",
        },
        { label: ticket ? `№${number} ${ticket.subject}` : `№${number}` },
    ];
}

function draftText(draft: FeedbackDraft | null): string | null {
    if (!draft) {
        return null;
    }
    if (draft.kind === "take") {
        return "Обращение взято в работу.";
    }
    if (draft.kind === "assign") {
        return `Назначен ответственный: ${draft.name}.`;
    }
    return `Статус: ${FEEDBACK_STATUS_LABELS[draft.status]}.`;
}

function replaceDraftLine(current: string, previous: string | null, next: string | null): string {
    const rest = previous && current.startsWith(previous)
        ? current.slice(previous.length).replace(/^\n/, "")
        : current;
    if (!next) {
        return rest;
    }
    return rest ? `${next}\n${rest}` : next;
}

function DialogMetaButton({ ticket, canProcess }: { ticket: Ticket; canProcess: boolean }) {
    return (
        <div className="md:hidden">
            <Popover>
                <PopoverTrigger
                    render={<Button type="button" variant="ghost" size="icon-sm" aria-label="Сведения об обращении" />}
                >
                    <Info />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-3 text-xs text-muted-foreground">
                    <p className="wrap-break-word">{dialogMeta(ticket, canProcess)}</p>
                </PopoverContent>
            </Popover>
        </div>
    );
}

function dialogMeta(ticket: Ticket, canProcess: boolean): string {
    const when = new Date(ticket.createdAt).toLocaleString("ru-RU");
    const created = canProcess ? `Создано ${ticket.author} · ${when}` : `Создано ${when}`;
    const responsible = assigneeLine(ticket, canProcess);
    return responsible ? `${created} · ${responsible}` : created;
}

function assigneeLine(ticket: Ticket, canProcess: boolean): string {
    if (ticket.assigneeName || ticket.assignee) {
        return `Ответственный: ${ticket.assigneeName ?? ticket.assignee}`;
    }
    return canProcess ? "Ответственный не назначен" : "";
}

function ChatBubble({
    mine,
    body,
    createdAt,
    files,
    color,
}: {
    mine: boolean;
    body: string;
    createdAt: string;
    files: TicketFile[];
    color: FeedbackDialogColor;
}) {
    return (
        <div className={cn("flex w-full", mine ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "flex min-w-0 max-w-[85%] flex-col gap-1 rounded-lg px-3 py-2",
                    files.length > 0 ? "w-full" : "w-fit",
                    mine ? color.mine : color.theirs,
                )}
            >
                {body ? <p className="wrap-break-word whitespace-pre-wrap text-sm">{body}</p> : null}
                <FeedbackFileLinks files={files} />
                <p className={cn("text-[11px] leading-none opacity-70", mine ? "text-right" : "text-left")}>
                    {new Date(createdAt).toLocaleString("ru-RU")}
                </p>
            </div>
        </div>
    );
}

const COMPOSER_MAX_HEIGHT = 128;

function composerPlaceholder(canProcess: boolean, status: FeedbackStatus): string {
    if (!canProcess && status === "waiting") {
        return "Ответьте на вопрос";
    }
    return "Напишите сообщение";
}
