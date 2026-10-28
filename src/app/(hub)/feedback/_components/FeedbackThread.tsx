"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeading } from "@/app/_components/header/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormAlert } from "@/components/form-alert";
import { StackSkeleton } from "@/components/loading-state";
import { FeedbackMessageList } from "./FeedbackChat";
import { FeedbackComposer } from "./FeedbackComposer";
import { FeedbackThreadHeader } from "./FeedbackThreadHeader";
import { useFeedbackFiles } from "./useFeedbackFiles";
import { useFeedbackDialogColor } from "./FeedbackDialogColor";
import {
    draftText,
    editPreview,
    latestMessageId,
    mergeTicket,
    replaceDraftLine,
    systemBody,
    systemNote,
    threadEntries,
    threadSources,
    ticketHeading,
    type MessageDraft,
    type ReplyBackup,
    type Ticket,
    type TicketFile,
    type TicketUpdate,
} from "./feedback-model";
import { isFeedbackCategory, isFeedbackKind } from "@/lib/content";
import { cn } from "@/lib/utils";
import { useAccess } from "@/hooks/useAccess";
import { notifySuccess } from "@/lib/notify";
import { ApiResponse } from "@/types/api";
import type { FeedbackDraft } from "./FeedbackStatusMenu";

type Pending = "reply";

const POLL_INTERVAL_MS = 4000;
const COMPOSER_MAX_HEIGHT = 128;

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
    const [classifying, setClassifying] = useState<"kind" | "category" | null>(null);
    const [messageDraft, setMessageDraft] = useState<MessageDraft | null>(null);
    const [kept, setKept] = useState<TicketFile[]>([]);
    const [replyBackup, setReplyBackup] = useState<ReplyBackup | null>(null);
    const [removingId, setRemovingId] = useState<number | null>(null);
    const [messagePending, setMessagePending] = useState<"edit" | "delete" | null>(null);
    const [scrollEdges, setScrollEdges] = useState({ top: false, bottom: false });
    const [draft, setDraft] = useState<FeedbackDraft | null>(null);
    const [draftLine, setDraftLine] = useState<string | null>(null);
    const [freshAfter, setFreshAfter] = useState<number | null>(null);
    const composerLocked = pending !== null || messagePending !== null;
    const attachments = useFeedbackFiles(files, composerLocked, setFiles, kept.length);
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
        if (!body.trim() && files.length === 0) {
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

    async function classify(field: "kind" | "category", value: string) {
        if (!ticket || classifying !== null) {
            return;
        }
        if (field === "kind" && (!isFeedbackKind(value) || value === ticket.kind)) {
            return;
        }
        if (field === "category" && (!isFeedbackCategory(value) || value === ticket.category)) {
            return;
        }
        setClassifying(field);
        setError(null);
        try {
            const response = await fetch(`/api/feedback/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
            });
            const json = (await response.json()) as ApiResponse<Ticket>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTicket(json.data);
            notifySuccess(field === "kind" ? "Вид обращения изменён" : "Категория изменена");
        } catch {
            setError(field === "kind" ? "Не удалось изменить вид обращения" : "Не удалось изменить категорию");
        } finally {
            setClassifying(null);
        }
    }

    function openMessage(target: { messageId: number | null; text: string; source: string; files: TicketFile[] }) {
        if (target.messageId === null || messagePending !== null) {
            return;
        }
        if (!messageDraft) {
            setReplyBackup({ body, files, draft, draftLine });
        }
        setError(null);
        setMessageDraft({
            id: target.messageId,
            source: target.source,
            preview: editPreview(target.text, target.files, target.source),
        });
        setKept(target.files);
        setBody(target.text);
        setFiles([]);
        setDraft(null);
        setDraftLine(null);
        queueMicrotask(() => composerRef.current?.focus());
    }

    function restoreReply() {
        const backup = replyBackup;
        setMessageDraft(null);
        setKept([]);
        setReplyBackup(null);
        setBody(backup?.body ?? "");
        setFiles(backup?.files ?? []);
        setDraft(backup?.draft ?? null);
        setDraftLine(backup?.draftLine ?? null);
    }

    async function saveMessage() {
        if (!messageDraft || messagePending !== null) {
            return;
        }
        const note = systemNote(messageDraft.source);
        const text = note ? systemBody(note, body) : body.trim();
        if (!text && kept.length === 0 && files.length === 0) {
            setError("Напишите сообщение");
            return;
        }
        setMessagePending("edit");
        setError(null);
        try {
            const form = new FormData();
            form.set("body", text);
            for (const file of kept) {
                form.append("keep", file.id);
            }
            for (const file of files) {
                form.append("file", file);
            }
            const response = await fetch(`/api/feedback/${params.id}/messages/${messageDraft.id}`, { method: "PATCH", body: form });
            const json = (await response.json()) as ApiResponse<Ticket>;
            if (!json.success) {
                setError(json.error.message);
                return;
            }
            setTicket(json.data);
            restoreReply();
            notifySuccess("Сообщение изменено");
        } catch {
            setError("Не удалось изменить сообщение");
        } finally {
            setMessagePending(null);
        }
    }

    async function removeMessage() {
        if (removingId === null || messagePending !== null) {
            return;
        }
        setMessagePending("delete");
        setError(null);
        try {
            const response = await fetch(`/api/feedback/${params.id}/messages/${removingId}`, { method: "DELETE" });
            const json = (await response.json()) as ApiResponse<Ticket>;
            if (!json.success) {
                setError(json.error.message);
                setRemovingId(null);
                return;
            }
            setTicket(json.data);
            if (messageDraft?.id === removingId) {
                restoreReply();
            }
            setRemovingId(null);
            notifySuccess("Сообщение удалено");
        } catch {
            setError("Не удалось удалить сообщение");
            setRemovingId(null);
        } finally {
            setMessagePending(null);
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
        if (messageDraft) {
            void saveMessage();
            return;
        }
        void send();
    }

    function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
            return;
        }
        if (composerLocked) {
            return;
        }
        if (messageDraft) {
            const note = systemNote(messageDraft.source);
            const text = note ? systemBody(note, body) : body.trim();
            if (!text && kept.length === 0 && files.length === 0) {
                return;
            }
            event.preventDefault();
            void saveMessage();
            return;
        }
        if (!body.trim() && files.length === 0) {
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
    const canAttach = !(closed && !canProcess);
    const mine = (author: string) => author.toLowerCase() === access.username?.toLowerCase();
    const thread = threadSources(ticket);
    const freshIndex = freshAfter === null ? -1 : thread.findIndex((item) => item.id !== null && item.id > freshAfter);
    const unseenCount = freshAfter === null ? 0 : ticket.messages.filter((message) => message.id > freshAfter).length;
    const entries = threadEntries(thread, freshIndex, mine);

    return (
        <div className="flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom,0px))] min-h-0 max-w-3xl flex-col max-md:-mx-4 max-md:-my-4 md:h-[calc(100dvh-4rem-3rem)]">
            <PageHeading trail={headingTrail} />
            <Card
                className="relative min-h-0 flex-1 rounded-none bg-transparent py-0 shadow-none ring-0 md:rounded-xl md:bg-card md:py-(--card-spacing) md:shadow-xs md:ring-1"
                size="sm"
                onDragEnter={canAttach ? attachments.onDragEnter : undefined}
                onDragOver={canAttach ? attachments.onDragOver : undefined}
                onDragLeave={canAttach ? attachments.onDragLeave : undefined}
                onDrop={canAttach ? attachments.onDrop : undefined}
                onPaste={canAttach ? attachments.onPaste : undefined}
            >
                {attachments.dragging && attachments.canAdd ? (
                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/80 ring-2 ring-primary ring-inset md:rounded-xl">
                        <p className="rounded-md bg-background px-3 py-2 text-sm font-medium shadow-sm">Отпустите файлы, чтобы приложить</p>
                    </div>
                ) : null}
                <FeedbackThreadHeader
                    ticket={ticket}
                    canProcess={canProcess}
                    classifying={classifying}
                    colorId={dialogColor.color.id}
                    onChooseColor={dialogColor.choose}
                    onClassify={(field, value) => void classify(field, value)}
                />
                <CardContent className="flex min-h-0 flex-1 flex-col gap-3 pb-2 md:pb-0">
                    <FeedbackMessageList
                        entries={entries}
                        color={dialogColor.color}
                        canProcess={canProcess}
                        closed={closed}
                        declined={ticket.status === "declined"}
                        scrollEdges={scrollEdges}
                        unseenCount={unseenCount}
                        threadRef={threadRef}
                        onScroll={syncScrollEdges}
                        onScrollDown={scrollDown}
                        onEdit={openMessage}
                        onDelete={setRemovingId}
                    />
                    {closed && !canProcess ? null : (
                        <FeedbackComposer
                            error={error}
                            body={body}
                            files={files}
                            kept={kept}
                            draft={draft}
                            messageDraft={messageDraft}
                            composerLocked={composerLocked}
                            savingReply={pending === "reply"}
                            savingEdit={messagePending === "edit"}
                            canProcess={canProcess}
                            status={ticket.status}
                            assignee={ticket.assignee}
                            sendClassName={dialogColor.color.send}
                            accept={attachments.accept}
                            previews={attachments.previews}
                            fileNotice={attachments.notice}
                            filesReady={attachments.ready}
                            canAdd={attachments.canAdd}
                            inputRef={attachments.inputRef}
                            composerRef={composerRef}
                            onBody={setBody}
                            onSubmit={onSubmit}
                            onKeyDown={onKeyDown}
                            onRestore={restoreReply}
                            onRemoveKept={(id) => setKept(kept.filter((file) => file.id !== id))}
                            onRemoveFile={(index) => setFiles(files.filter((_, item) => item !== index))}
                            onAddFiles={attachments.addFiles}
                            onPickFiles={() => attachments.inputRef.current?.click()}
                            onDraft={chooseDraft}
                        />
                    )}
                </CardContent>
            </Card>
            <ConfirmDialog
                open={removingId !== null}
                title="Удалить сообщение?"
                description="Сообщение и его вложения будут удалены."
                confirmLabel="Удалить"
                isPending={messagePending === "delete"}
                onConfirm={removeMessage}
                onOpenChange={(open) => {
                    if (!open) {
                        setRemovingId(null);
                    }
                }}
            />
        </div>
    );
}
