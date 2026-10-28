import type { PageHeadingCrumb } from "@/app/_components/header/page-heading";
import {
    FEEDBACK_STATUS_LABELS,
    type FeedbackCategory,
    type FeedbackKind,
    type FeedbackStatus,
} from "@/lib/content";
import type { FeedbackDraft } from "./FeedbackStatusMenu";

export interface TicketFile {
    id: string;
    filename: string;
    sizeBytes: number;
}

export interface TicketMessage {
    id: number;
    author: string;
    authorName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    files: TicketFile[];
}

export interface Ticket {
    id: number;
    author: string;
    authorName: string;
    subject: string;
    body: string;
    status: FeedbackStatus;
    kind: FeedbackKind | null;
    category: FeedbackCategory | null;
    articleId: number | null;
    documentTitle: string | null;
    assignee: string | null;
    assigneeName: string | null;
    createdAt: string;
    files: TicketFile[];
    messages: TicketMessage[];
}

export interface TicketUpdate {
    changed: boolean;
    status: FeedbackStatus;
    assignee: string | null;
    assigneeName: string | null;
    messages: TicketMessage[];
}

export interface MessageDraft {
    id: number;
    source: string;
    preview: string;
}

export interface ReplyBackup {
    body: string;
    files: File[];
    draft: FeedbackDraft | null;
    draftLine: string | null;
}

export interface SystemNote {
    kind: "status" | "take" | "assign";
    detail: string;
    rest: string;
}

export interface ThreadSource {
    key: string;
    id: number | null;
    author: string;
    authorName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    files: TicketFile[];
}

export type ThreadEntry = {
    kind: "fresh";
    key: string;
} | {
    kind: "system";
    key: string;
    note: SystemNote;
    createdAt: string;
    messageId: number | null;
    author: string;
    mine: boolean;
    text: string;
    hasFiles: boolean;
    source: string;
} | {
    kind: "bubble";
    key: string;
    author: string;
    authorName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    files: TicketFile[];
    mine: boolean;
    continued: boolean;
    tail: boolean;
    messageId: number | null;
    text: string;
    hasFiles: boolean;
    source: string;
};

export function systemNote(body: string): SystemNote | null {
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

export function systemBody(note: SystemNote, spoken: string): string {
    const text = spoken.trim();
    const head = note.kind === "take"
        ? "Обращение взято в работу."
        : note.kind === "assign"
            ? `Назначен ответственный: ${note.detail}.`
            : `Статус: ${note.detail}.`;
    return text ? `${head} ${text}` : head;
}

export function editPreview(text: string, files: TicketFile[], source: string): string {
    const line = text.trim().split("\n")[0] ?? "";
    if (line) {
        return line;
    }
    if (files[0]) {
        return files[0].filename;
    }
    const note = systemNote(source);
    if (!note) {
        return "Сообщение";
    }
    return systemBody(note, "");
}

export function canSubmitMessage(draft: MessageDraft | null, text: string, kept: number, added: number): boolean {
    if (!draft) {
        return Boolean(text.trim() || added > 0);
    }
    const note = systemNote(draft.source);
    const body = note ? systemBody(note, text) : text.trim();
    return Boolean(body || kept > 0 || added > 0);
}

export function latestMessageId(ticket: Ticket): number {
    return ticket.messages.reduce((max, message) => Math.max(max, message.id), 0);
}

export function mergeTicket(current: Ticket, update: TicketUpdate): Ticket {
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

export function ticketHeading(id: string, ticket: Ticket | null): PageHeadingCrumb[] {
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

export function draftText(draft: FeedbackDraft | null): string | null {
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

export function replaceDraftLine(current: string, previous: string | null, next: string | null): string {
    const rest = previous && current.startsWith(previous)
        ? current.slice(previous.length).replace(/^\n/, "")
        : current;
    if (!next) {
        return rest;
    }
    return rest ? `${next}\n${rest}` : next;
}

export function threadSources(ticket: Ticket): ThreadSource[] {
    return [
        {
            key: "ticket",
            id: null,
            author: ticket.author,
            authorName: ticket.authorName,
            body: ticket.body,
            createdAt: ticket.createdAt,
            editedAt: null,
            files: ticket.files,
        },
        ...ticket.messages.map((message) => ({
            key: String(message.id),
            id: message.id,
            author: message.author,
            authorName: message.authorName,
            body: message.body,
            createdAt: message.createdAt,
            editedAt: message.editedAt,
            files: message.files,
        })),
    ];
}

export function threadEntries(thread: ThreadSource[], freshIndex: number, mine: (author: string) => boolean): ThreadEntry[] {
    const entries: ThreadEntry[] = [];
    thread.forEach((message, index) => {
        const note = systemNote(message.body);
        const spoken = note ? note.rest : message.body;
        const showBubble = Boolean(spoken || message.files.length > 0 || !note);
        if (index === freshIndex) {
            entries.push({ kind: "fresh", key: `fresh-${message.key}` });
        }
        if (note) {
            entries.push({
                kind: "system",
                key: `system-${message.key}`,
                note,
                createdAt: message.createdAt,
                messageId: showBubble ? null : message.id,
                author: message.author,
                mine: mine(message.author),
                text: note.rest,
                hasFiles: false,
                source: message.body,
            });
        }
        if (showBubble) {
            entries.push({
                kind: "bubble",
                key: message.key,
                author: message.author,
                authorName: message.authorName,
                body: spoken,
                createdAt: message.createdAt,
                editedAt: message.editedAt,
                files: message.files,
                mine: mine(message.author),
                continued: false,
                tail: true,
                messageId: message.id,
                text: spoken,
                hasFiles: message.files.length > 0,
                source: message.body,
            });
        }
    });
    entries.forEach((entry, index) => {
        if (entry.kind !== "bubble") {
            return;
        }
        const previous = entries[index - 1];
        const next = entries[index + 1];
        const sameAuthor = (other: ThreadEntry | undefined) => other?.kind === "bubble" && other.author.toLowerCase() === entry.author.toLowerCase();
        entry.continued = sameAuthor(previous);
        entry.tail = !sameAuthor(next);
    });
    return entries;
}

export function entrySpace(entry: ThreadEntry, previous: ThreadEntry | undefined): string {
    if (!previous) {
        return "";
    }
    return entry.kind === "bubble" && entry.continued ? "mt-0.5" : "mt-3";
}
