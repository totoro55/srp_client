import { randomUUID } from "crypto";
import {
    FEEDBACK_BODY_MAX,
    FEEDBACK_MESSAGE_MAX,
    FEEDBACK_STATUS_LABELS,
    FEEDBACK_SUBJECT_MAX,
    boundedText,
    optionalText,
    FEEDBACK_ARTICLE_CATEGORY,
    isFeedbackCategory,
    isFeedbackKind,
    isFeedbackStatus,
    type FeedbackCategory,
    type FeedbackKind,
    type FeedbackStatus,
} from "@/lib/content";
import {
    feedbackExtension,
    feedbackFileMime,
    parseFeedbackExtensions,
} from "@/lib/feedback-files";
import { ADMIN_PAGE_SIZE, likePattern, pageCount } from "@/lib/list-page";
import { can } from "@/lib/access";
import type { AccessView } from "@/server/authz/resolve-access";
import { ContentError } from "@/services/content-error";
import { db } from "@/services/db";
import { getAppSettings } from "@/services/app-settings";
import { deleteStoredObject, putStoredObject, readStoredObject } from "@/services/object-storage";
import { markFeedbackSeen, notifyFeedback } from "@/services/notifications";
import { getWikiArticle } from "@/services/wiki";

export interface FeedbackTicket {
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
    updatedAt: string;
    unread: boolean;
    files: FeedbackFile[];
    messages: FeedbackMessage[];
}

export interface FeedbackFile {
    id: string;
    filename: string;
    mime: string;
    sizeBytes: number;
}

export interface FeedbackMessage {
    id: number;
    author: string;
    authorName: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    files: FeedbackFile[];
}

export interface FeedbackChanges {
    changed: boolean;
    status: FeedbackStatus;
    assignee: string | null;
    assigneeName: string | null;
    messages: FeedbackMessage[];
}

interface TicketRow {
    id: number;
    author: string;
    author_name: string;
    subject: string;
    body: string;
    status: FeedbackStatus;
    kind: string | null;
    category: string | null;
    article_id: number | null;
    document_title: string | null;
    assignee: string | null;
    assignee_name: string | null;
    created_at: Date;
    updated_at: Date;
    unread?: boolean;
}

export interface FeedbackAssignee {
    login: string;
    name: string;
}

export interface FeedbackListPage {
    items: Omit<FeedbackTicket, "messages" | "files">[];
    page: number;
    pageSize: number;
    total: number;
}

const FEEDBACK_FILTER = `
    WHERE ($1::boolean OR lower(ticket.author) = lower($2) OR lower(ticket.assignee) = lower($2))
      AND (
        $3 = ''
        OR ticket.subject ILIKE $4 ESCAPE '\\'
        OR ticket.body ILIKE $4 ESCAPE '\\'
        OR ticket.author ILIKE $4 ESCAPE '\\'
        OR EXISTS (
            SELECT 1 FROM employees employee
            WHERE lower(employee.login) = lower(ticket.author)
              AND employee.name ILIKE $4 ESCAPE '\\'
        )
        OR ticket.document_title ILIKE $4 ESCAPE '\\'
        OR EXISTS (
            SELECT 1 FROM wiki_articles linked
            WHERE linked.id = ticket.article_id
              AND linked.title ILIKE $4 ESCAPE '\\'
        )
        OR EXISTS (
            SELECT 1 FROM feedback_messages
            WHERE ticket_id = ticket.id AND body ILIKE $4 ESCAPE '\\'
        )
      )
      AND (
        cardinality($5::text[]) = 0
        OR ticket.status = ANY($5::text[])
      )
      AND (
        cardinality($6::text[]) = 0
        OR ('none' = ANY($6::text[]) AND ticket.kind IS NULL)
        OR ticket.kind = ANY($6::text[])
      )
      AND (
        cardinality($7::text[]) = 0
        OR ('none' = ANY($7::text[]) AND ticket.category IS NULL)
        OR ticket.category = ANY($7::text[])
      )
`;

const AUTHOR_NAME = `
    COALESCE(
        NULLIF(btrim((
            SELECT employee.name
            FROM employees employee
            WHERE lower(employee.login) = lower(ticket.author)
            LIMIT 1
        )), ''),
        ticket.author
    )
`;

const ASSIGNEE_NAME = `
    COALESCE(
        NULLIF(btrim(employee.name), ''),
        ticket.assignee
    )
`;

const UNREAD = `
    (
        EXISTS (
            SELECT 1 FROM feedback_messages message
            WHERE message.ticket_id = ticket.id
              AND lower(message.author) <> lower($2)
              AND message.id > COALESCE((
                  SELECT visit.seen_message_id
                  FROM feedback_visits visit
                  WHERE visit.ticket_id = ticket.id AND visit.username = lower($2)
              ), 0)
        )
        OR (
            lower(ticket.author) <> lower($2)
            AND NOT EXISTS (
                SELECT 1 FROM feedback_visits visit
                WHERE visit.ticket_id = ticket.id AND visit.username = lower($2)
            )
        )
    )
`;

const TICKET_FROM = `
    FROM feedback_tickets ticket
    LEFT JOIN employees employee ON lower(employee.login) = lower(ticket.assignee)
    LEFT JOIN wiki_articles wiki ON wiki.id = ticket.article_id
`;

export async function listFeedback(
    access: AccessView,
    query: string,
    statuses: readonly string[],
    kinds: readonly string[],
    categories: readonly string[],
    requestedPage: number,
): Promise<FeedbackListPage> {
    const processor = can(access, "feedback:process");
    const filterParams = [processor, access.username, query, likePattern(query), statuses, kinds, categories];
    const totals = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM feedback_tickets ticket ${FEEDBACK_FILTER}`,
        filterParams
    );
    const total = totals[0]?.total ?? 0;
    const page = Math.min(requestedPage, pageCount(total, ADMIN_PAGE_SIZE));
    const rows = await db.query<TicketRow>(
        `
        SELECT ticket.id, ticket.author, ${AUTHOR_NAME} AS author_name,
               ticket.subject, ticket.body, ticket.status, ticket.kind, ticket.category,
               ticket.article_id,
               COALESCE(NULLIF(btrim(wiki.title), ''), NULLIF(btrim(ticket.document_title), '')) AS document_title,
               ticket.assignee, ${ASSIGNEE_NAME} AS assignee_name,
               ticket.created_at, ticket.updated_at,
               ${UNREAD} AS unread
        ${TICKET_FROM}
        ${FEEDBACK_FILTER}
        ORDER BY ticket.updated_at DESC, ticket.id DESC
        LIMIT $8 OFFSET $9
        `,
        [...filterParams, ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE]
    );
    return {
        items: rows.map(toTicket),
        page,
        pageSize: ADMIN_PAGE_SIZE,
        total,
    };
}

export async function getFeedback(access: AccessView, id: number): Promise<FeedbackTicket> {
    const ticket = await loadTicket(id);
    if (!canReadTicket(access, ticket)) {
        throw new ContentError("Обращение не найдено");
    }
    await markFeedbackSeen(access.username, id);
    const files = await filesOf(id);
    return {
        ...toTicket(ticket),
        files: files.filter((file) => file.messageId === null).map(toFile),
        messages: (await messagesOf(id)).map((message) => ({
            ...message,
            files: files.filter((file) => file.messageId === message.id).map(toFile),
        })),
    };
}

export async function feedbackChanges(
    access: AccessView,
    id: number,
    after: number,
    knownStatus: string | null,
    knownAssignee: string | null,
): Promise<FeedbackChanges> {
    const ticket = await loadTicket(id);
    if (!canReadTicket(access, ticket)) {
        throw new ContentError("Обращение не найдено");
    }
    const messages = await messagesOf(id, after);
    if (messages.length > 0) {
        await markFeedbackSeen(access.username, id);
    }
    const sameHeader = knownStatus === ticket.status && (knownAssignee ?? "") === (ticket.assignee ?? "");
    if (sameHeader && messages.length === 0) {
        return {
            changed: false,
            status: ticket.status,
            assignee: ticket.assignee,
            assigneeName: ticket.assignee_name,
            messages: [],
        };
    }
    const files = messages.length === 0 ? [] : await filesOfMessages(id, messages.map((message) => message.id));
    return {
        changed: true,
        status: ticket.status,
        assignee: ticket.assignee,
        assigneeName: ticket.assignee_name,
        messages: messages.map((message) => ({
            ...message,
            files: files.filter((file) => file.messageId === message.id).map(toFile),
        })),
    };
}

export async function createFeedback(access: AccessView, body: unknown, files: File[] = []): Promise<FeedbackTicket> {
    if (!can(access, "feedback:write")) {
        throw new ContentError("Недостаточно прав");
    }
    const input = readTicket(body);
    const article = input.articleId === null ? null : await getWikiArticle(access, input.articleId);
    const rows = await db.query<{ id: number }>(
        `
        INSERT INTO feedback_tickets (author, subject, body, kind, category, article_id, document_title)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
        `,
        [access.username, input.subject, input.body, input.kind, input.category, article?.id ?? null, article?.title ?? null]
    );
    const id = rows[0].id;
    try {
        await addFeedbackFiles(access, id, null, files);
    } catch (error) {
        await db.query("DELETE FROM feedback_tickets WHERE id = $1", [id]);
        throw error;
    }
    const created = await getFeedback(access, id);
    await notifyFeedback({
        actor: access.username,
        ticketId: id,
        subject: created.subject,
        author: created.author,
        assignee: created.assignee,
        event: "created",
    });
    return created;
}

export async function addFeedbackMessage(
    access: AccessView,
    id: number,
    body: unknown,
    files: File[] = [],
    requestedStatus: string | null = null,
    action: string | null = null,
    assignee: string | null = null,
): Promise<FeedbackTicket> {
    const ticket = await getFeedback(access, id);
    if (!can(access, "feedback:process") && (ticket.status === "done" || ticket.status === "declined")) {
        throw new ContentError("Обращение закрыто");
    }
    const text = readMessage(body);
    if (!text && files.length === 0) {
        throw new ContentError("Напишите ответ");
    }
    const change = await messageChange(access, ticket, requestedStatus, action, assignee);
    const inserted = await db.transaction(async (query) => {
        const messages = await query<{ id: number }>(
            "INSERT INTO feedback_messages (ticket_id, author, body) VALUES ($1, $2, $3) RETURNING id",
            [id, access.username, text]
        );
        if (change) {
            await query(
                "UPDATE feedback_tickets SET status = $2, assignee = $3, updated_at = NOW() WHERE id = $1",
                [id, change.status, change.assignee]
            );
        } else {
            await query("UPDATE feedback_tickets SET updated_at = NOW() WHERE id = $1", [id]);
        }
        return messages[0].id;
    });
    try {
        await addFeedbackFiles(access, id, inserted, files);
    } catch (error) {
        await db.query("DELETE FROM feedback_messages WHERE id = $1", [inserted]);
        throw error;
    }
    const updated = await getFeedback(access, id);
    await notifyFeedback({
        actor: access.username,
        ticketId: id,
        subject: updated.subject,
        author: ticket.author,
        assignee: change?.assignee ?? ticket.assignee,
        event: "reply",
    });
    return updated;
}

export async function updateFeedbackMessage(
    access: AccessView,
    ticketId: number,
    messageId: number,
    body: unknown,
    files: File[] = [],
    keep: readonly string[] | null = null,
): Promise<FeedbackTicket> {
    await ownMessage(access, ticketId, messageId);
    const text = readMessage(body);
    const existing = await db.query<{ id: string; storage_key: string }>(
        "SELECT id, storage_key FROM feedback_files WHERE ticket_id = $1 AND message_id = $2",
        [ticketId, messageId]
    );
    const known = new Map(existing.map((file) => [file.id, file.storage_key]));
    const keptIds = keep === null ? [...known.keys()] : [...new Set(keep)];
    if (keptIds.some((id) => !known.has(id))) {
        throw new ContentError("Вложение не найдено");
    }
    const settings = await getAppSettings();
    if (keptIds.length + files.length > settings.feedbackFileMaxCount) {
        throw new ContentError(`Можно приложить не больше ${settings.feedbackFileMaxCount} файлов`);
    }
    if (!text && keptIds.length + files.length === 0) {
        throw new ContentError("Напишите ответ");
    }
    await db.query("UPDATE feedback_messages SET body = $2, edited_at = NOW() WHERE id = $1", [messageId, text]);
    await addFeedbackFiles(access, ticketId, messageId, files);
    const removed = existing.filter((file) => !keptIds.includes(file.id));
    if (removed.length > 0) {
        await db.query("DELETE FROM feedback_files WHERE id = ANY($1::uuid[])", [removed.map((file) => file.id)]);
        await Promise.all(removed.map((file) => deleteStoredObject(file.storage_key)));
    }
    await db.query("UPDATE feedback_tickets SET updated_at = NOW() WHERE id = $1", [ticketId]);
    return getFeedback(access, ticketId);
}

export async function deleteFeedbackMessage(access: AccessView, ticketId: number, messageId: number): Promise<FeedbackTicket> {
    await ownMessage(access, ticketId, messageId);
    const stored = await db.query<{ storage_key: string }>(
        "SELECT storage_key FROM feedback_files WHERE ticket_id = $1 AND message_id = $2",
        [ticketId, messageId]
    );
    await db.query("DELETE FROM feedback_messages WHERE id = $1 AND ticket_id = $2", [messageId, ticketId]);
    await db.query("UPDATE feedback_tickets SET updated_at = NOW() WHERE id = $1", [ticketId]);
    await Promise.all(stored.map((file) => deleteStoredObject(file.storage_key)));
    return getFeedback(access, ticketId);
}

async function ownMessage(access: AccessView, ticketId: number, messageId: number): Promise<void> {
    if (!can(access, "feedback:process")) {
        throw new ContentError("Недостаточно прав");
    }
    const ticket = await loadTicket(ticketId);
    if (!canReadTicket(access, ticket)) {
        throw new ContentError("Обращение не найдено");
    }
    const rows = await db.query<{ author: string }>(
        "SELECT author FROM feedback_messages WHERE id = $1 AND ticket_id = $2",
        [messageId, ticketId]
    );
    const message = rows[0];
    if (!message) {
        throw new ContentError("Сообщение не найдено");
    }
    if (message.author.toLowerCase() !== access.username.toLowerCase()) {
        throw new ContentError("Можно править только свои сообщения");
    }
}

export async function listFeedbackAssignees(access: AccessView, query: string): Promise<FeedbackAssignee[]> {
    const pattern = likePattern(query.toLowerCase());
    return db.query<FeedbackAssignee>(
        `
        SELECT people.login, people.name
        FROM (
            SELECT candidate.login,
                   COALESCE(
                       NULLIF(btrim(employee.name), ''),
                       candidate.login
                   ) AS name
            FROM (
                SELECT rr.match_value AS login
                FROM role_rules rr
                JOIN roles r ON r.id = rr.role_id
                WHERE rr.match_type = 'login'
                  AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
                  AND (
                    r.is_system
                    OR EXISTS (
                        SELECT 1 FROM role_permission_codes p
                        WHERE p.role_id = r.id AND p.permission_code = 'feedback:process'
                    )
                  )
                UNION
                SELECT employee.login
                FROM role_rules rr
                JOIN roles r ON r.id = rr.role_id
                JOIN employees employee ON employee.title = rr.match_value AND btrim(employee.login) <> ''
                WHERE rr.match_type = 'title'
                  AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
                  AND (
                    r.is_system
                    OR EXISTS (
                        SELECT 1 FROM role_permission_codes p
                        WHERE p.role_id = r.id AND p.permission_code = 'feedback:process'
                    )
                  )
                UNION
                SELECT $3::varchar
            ) candidate
            LEFT JOIN employees employee ON lower(employee.login) = lower(candidate.login)
        ) people
        WHERE btrim(people.login) <> ''
          AND (
            $1::text = ''
            OR lower(people.login) LIKE $2 ESCAPE '\\'
            OR lower(people.name) LIKE $2 ESCAPE '\\'
          )
        ORDER BY people.name, people.login
        LIMIT 30
        `,
        [query.toLowerCase(), pattern, access.username]
    );
}

export async function setFeedbackClass(access: AccessView, id: number, body: unknown): Promise<FeedbackTicket> {
    if (!can(access, "feedback:process")) {
        throw new ContentError("Недостаточно прав");
    }
    const ticket = await getFeedback(access, id);
    if (!body || typeof body !== "object") {
        throw new ContentError("Выберите вид или категорию");
    }
    const record = body as Record<string, unknown>;
    const hasKind = Object.prototype.hasOwnProperty.call(record, "kind");
    const hasCategory = Object.prototype.hasOwnProperty.call(record, "category");
    if (!hasKind && !hasCategory) {
        throw new ContentError("Выберите вид или категорию");
    }
    const kind = hasKind ? record.kind : ticket.kind;
    const category = hasCategory ? record.category : ticket.category;
    if (hasKind && !isFeedbackKind(kind)) {
        throw new ContentError("Выберите вид обращения");
    }
    if (hasCategory && !isFeedbackCategory(category)) {
        throw new ContentError("Выберите категорию");
    }
    await db.query(
        "UPDATE feedback_tickets SET kind = $2, category = $3, updated_at = NOW() WHERE id = $1",
        [id, kind, category]
    );
    return getFeedback(access, id);
}

export async function setFeedbackHandling(access: AccessView, id: number, body: unknown): Promise<FeedbackTicket> {
    const ticket = await getFeedback(access, id);
    const action = readHandlingAction(body);
    const note = readNote(body);
    const notify = readNotify(body);
    let status = ticket.status;
    let assignee = ticket.assignee;
    if (action === "take") {
        status = "progress";
        assignee = access.username;
    } else if (action === "assign") {
        assignee = await processorLogin(access, body);
        status = "progress";
    } else {
        const next = readStatus(body);
        if (!next) {
            throw new ContentError("Выберите статус");
        }
        status = next;
    }
    const assigneeName = assignee ? await assigneeDisplayName(assignee) : "";
    await db.transaction(async (query) => {
        await query(
            "UPDATE feedback_tickets SET status = $2, assignee = $3, updated_at = NOW() WHERE id = $1",
            [id, status, assignee]
        );
        if (notify) {
            await query(
                "INSERT INTO feedback_messages (ticket_id, author, body) VALUES ($1, $2, $3)",
                [id, access.username, handlingText(action, status, assigneeName, note)]
            );
        }
    });
    const updated = await getFeedback(access, id);
    if (notify) {
        await notifyFeedback({
            actor: access.username,
            ticketId: id,
            subject: updated.subject,
            author: ticket.author,
            assignee,
            event: "reply",
        });
    }
    return updated;
}

async function loadTicket(id: number): Promise<TicketRow & { messages?: never }> {
    const rows = await db.query<TicketRow>(
        `
        SELECT ticket.id, ticket.author, ${AUTHOR_NAME} AS author_name,
               ticket.subject, ticket.body, ticket.status, ticket.kind, ticket.category,
               ticket.article_id,
               COALESCE(NULLIF(btrim(wiki.title), ''), NULLIF(btrim(ticket.document_title), '')) AS document_title,
               ticket.assignee, ${ASSIGNEE_NAME} AS assignee_name,
               ticket.created_at, ticket.updated_at
        ${TICKET_FROM}
        WHERE ticket.id = $1
        `,
        [id]
    );
    if (rows.length === 0) {
        throw new ContentError("Обращение не найдено");
    }
    return rows[0];
}

function canReadTicket(access: AccessView, ticket: { author: string; assignee: string | null }): boolean {
    const username = access.username.toLowerCase();
    return can(access, "feedback:process")
        || ticket.author.toLowerCase() === username
        || ticket.assignee?.toLowerCase() === username;
}

async function messagesOf(ticketId: number, after = 0): Promise<Omit<FeedbackMessage, "files">[]> {
    const rows = await db.query<{ id: number; author: string; author_name: string; body: string; created_at: Date; edited_at: Date | null }>(
        `
        SELECT message.id, message.author,
               COALESCE(
                   NULLIF(btrim((
                       SELECT employee.name
                       FROM employees employee
                       WHERE lower(employee.login) = lower(message.author)
                       LIMIT 1
                   )), ''),
                   message.author
               ) AS author_name,
               message.body, message.created_at, message.edited_at
        FROM feedback_messages message
        WHERE message.ticket_id = $1 AND message.id > $2
        ORDER BY message.id
        `,
        [ticketId, after]
    );
    return rows.map((row) => ({
        id: row.id,
        author: row.author,
        authorName: row.author_name.trim() || row.author,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
        editedAt: row.edited_at ? new Date(row.edited_at).toISOString() : null,
    }));
}

export async function readFeedbackFile(access: AccessView, id: string): Promise<{ filename: string; mime: string; content: Buffer }> {
    const rows = await db.query<{ ticket_id: number; filename: string; mime: string; storage_key: string }>(
        "SELECT ticket_id, filename, mime, storage_key FROM feedback_files WHERE id = $1",
        [id]
    );
    const file = rows[0];
    if (!file) {
        throw new ContentError("Вложение не найдено");
    }
    await getFeedback(access, file.ticket_id);
    const content = await readStoredObject(file.storage_key);
    if (!content) {
        throw new ContentError("Вложение не найдено");
    }
    return { filename: file.filename, mime: file.mime, content };
}

export async function readFeedbackRequest(request: Request): Promise<{
    body: unknown;
    files: File[];
    status: string | null;
    action: "take" | "assign" | null;
    assignee: string | null;
}> {
    const type = request.headers.get("content-type") ?? "";
    if (!type.includes("multipart/form-data")) {
        const json = await request.json() as unknown;
        return { body: json, files: [], status: statusField(json), action: actionField(json), assignee: textField(json, "assignee") };
    }
    const form = await request.formData();
    const record: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
            record[key] = value;
        }
    }
    const files = form.getAll("file").filter((item): item is File => item instanceof File && item.size > 0);
    return { body: record, files, status: statusField(record), action: actionField(record), assignee: textField(record, "assignee") };
}

async function addFeedbackFiles(access: AccessView, ticketId: number, messageId: number | null, files: File[]): Promise<void> {
    if (files.length === 0) {
        return;
    }
    const settings = await getAppSettings();
    const allowed = new Set(parseFeedbackExtensions(settings.feedbackFileExtensions));
    const maxBytes = settings.feedbackFileMaxMb * 1024 * 1024;
    if (files.length > settings.feedbackFileMaxCount) {
        throw new ContentError(`Можно приложить не больше ${settings.feedbackFileMaxCount} файлов`);
    }
    const saved: { id: string; key: string }[] = [];
    try {
        for (const file of files) {
            const prepared = await prepareFile(file, allowed, maxBytes, settings.feedbackFileMaxMb);
            const id = randomUUID();
            const key = `feedback/${ticketId}/${id}`;
            await putStoredObject(key, prepared.content, prepared.mime);
            saved.push({ id, key });
            await db.query(
                `
                INSERT INTO feedback_files (id, ticket_id, message_id, filename, mime, size_bytes, storage_key, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `,
                [id, ticketId, messageId, prepared.filename, prepared.mime, prepared.content.length, key, access.username]
            );
        }
    } catch (error) {
        await Promise.all(saved.map(async (item) => {
            await deleteStoredObject(item.key);
        }));
        if (saved.length > 0) {
            await db.query("DELETE FROM feedback_files WHERE id = ANY($1::uuid[])", [saved.map((item) => item.id)]);
        }
        if (error instanceof ContentError) {
            throw error;
        }
        throw new ContentError("Не удалось сохранить вложение");
    }
}

async function prepareFile(
    file: File,
    allowed: Set<string>,
    maxBytes: number,
    maxMb: number,
): Promise<{ filename: string; mime: string; content: Buffer }> {
    if (file.size > maxBytes) {
        throw new ContentError(`Файл больше ${maxMb} МБ`);
    }
    const filename = (file.name.split(/[/\\]/).pop() ?? "").trim().slice(0, 255) || "файл";
    const extension = feedbackExtension(filename);
    const mime = feedbackFileMime(extension);
    if (!mime || !allowed.has(extension)) {
        throw new ContentError("Такой файл приложить нельзя");
    }
    return { filename, mime, content: Buffer.from(await file.arrayBuffer()) };
}

interface StoredFile extends FeedbackFile {
    messageId: number | null;
}

async function filesOfMessages(ticketId: number, messageIds: number[]): Promise<StoredFile[]> {
    const rows = await db.query<{ id: string; message_id: number | null; filename: string; mime: string; size_bytes: number }>(
        `
        SELECT id, message_id, filename, mime, size_bytes
        FROM feedback_files
        WHERE ticket_id = $1 AND message_id = ANY($2::int[])
        ORDER BY created_at, id
        `,
        [ticketId, messageIds]
    );
    return rows.map(storedFile);
}

async function filesOf(ticketId: number): Promise<StoredFile[]> {
    const rows = await db.query<{ id: string; message_id: number | null; filename: string; mime: string; size_bytes: number }>(
        "SELECT id, message_id, filename, mime, size_bytes FROM feedback_files WHERE ticket_id = $1 ORDER BY created_at, id",
        [ticketId]
    );
    return rows.map(storedFile);
}

function storedFile(row: { id: string; message_id: number | null; filename: string; mime: string; size_bytes: number }): StoredFile {
    return {
        id: row.id,
        messageId: row.message_id,
        filename: row.filename,
        mime: row.mime,
        sizeBytes: row.size_bytes,
    };
}

function toFile(file: StoredFile): FeedbackFile {
    return { id: file.id, filename: file.filename, mime: file.mime, sizeBytes: file.sizeBytes };
}

function toTicket(row: TicketRow): Omit<FeedbackTicket, "messages" | "files"> {
    return {
        id: row.id,
        author: row.author,
        authorName: row.author_name?.trim() || row.author,
        subject: row.subject,
        body: row.body,
        status: row.status,
        kind: isFeedbackKind(row.kind) ? row.kind : null,
        category: isFeedbackCategory(row.category) ? row.category : null,
        articleId: row.article_id,
        documentTitle: shownDocumentTitle(row),
        assignee: row.assignee,
        assigneeName: row.assignee_name,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
        unread: row.unread === true,
    };
}

function shownDocumentTitle(row: TicketRow): string | null {
    const title = row.document_title?.trim() ?? "";
    if (title) {
        return title;
    }
    return row.article_id === null ? null : "Статья";
}

function readTicket(body: unknown): { subject: string; body: string; kind: FeedbackKind; category: FeedbackCategory; articleId: number | null } {
    if (!body || typeof body !== "object") {
        throw new ContentError("Проверьте тему и текст");
    }
    const record = body as Record<string, unknown>;
    const subject = boundedText(record.subject, FEEDBACK_SUBJECT_MAX, "Тема");
    const text = boundedText(record.body, FEEDBACK_BODY_MAX, "Текст");
    if (typeof subject !== "string") {
        throw new ContentError(subject.error);
    }
    if (typeof text !== "string") {
        throw new ContentError(text.error);
    }
    if (!isFeedbackKind(record.kind)) {
        throw new ContentError("Выберите вид обращения");
    }
    if (!isFeedbackCategory(record.category)) {
        throw new ContentError("Выберите категорию");
    }
    const articleId = readArticleId(record.articleId);
    if (articleId !== null && record.category !== FEEDBACK_ARTICLE_CATEGORY) {
        throw new ContentError("Категория обращения из статьи — база знаний");
    }
    return { subject, body: text, kind: record.kind, category: record.category, articleId };
}

function readArticleId(value: unknown): number | null {
    if (value == null || value === "") {
        return null;
    }
    const id = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : Number.NaN;
    if (!Number.isInteger(id) || id <= 0) {
        throw new ContentError("Статья не найдена");
    }
    return id;
}

function readMessage(body: unknown): string {
    if (!body || typeof body !== "object") {
        throw new ContentError("Напишите ответ");
    }
    const text = optionalText((body as Record<string, unknown>).body, FEEDBACK_MESSAGE_MAX, "Ответ");
    if (typeof text !== "string") {
        throw new ContentError(text.error);
    }
    return text;
}

function readHandlingAction(body: unknown): "take" | "assign" | "status" {
    if (!body || typeof body !== "object") {
        throw new ContentError("Выберите действие");
    }
    const action = (body as Record<string, unknown>).action;
    if (action === "take" || action === "assign" || action === "status") {
        return action;
    }
    throw new ContentError("Выберите действие");
}

function readNotify(body: unknown): boolean {
    return Boolean(body && typeof body === "object" && (body as Record<string, unknown>).notify === true);
}

function readNote(body: unknown): string {
    if (!body || typeof body !== "object") {
        return "";
    }
    const note = (body as Record<string, unknown>).note;
    if (note == null || note === "") {
        return "";
    }
    const text = boundedText(note, FEEDBACK_MESSAGE_MAX, "Комментарий");
    if (typeof text !== "string") {
        throw new ContentError(text.error);
    }
    return text;
}

async function processorLogin(access: AccessView, body: unknown): Promise<string> {
    if (!body || typeof body !== "object") {
        throw new ContentError("Выберите сотрудника");
    }
    const login = (body as Record<string, unknown>).assignee;
    if (typeof login !== "string" || login.trim() === "") {
        throw new ContentError("Выберите сотрудника");
    }
    if (login.trim().toLowerCase() === access.username.toLowerCase()) {
        return access.username;
    }
    const rows = await db.query<{ login: string }>(
        `
        SELECT candidate.login
        FROM (
            SELECT rr.match_value AS login
            FROM role_rules rr
            JOIN roles r ON r.id = rr.role_id
            WHERE rr.match_type = 'login'
              AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
              AND (
                r.is_system
                OR EXISTS (
                    SELECT 1 FROM role_permission_codes p
                    WHERE p.role_id = r.id AND p.permission_code = 'feedback:process'
                )
              )
            UNION
            SELECT employee.login
            FROM role_rules rr
            JOIN roles r ON r.id = rr.role_id
            JOIN employees employee ON employee.title = rr.match_value AND btrim(employee.login) <> ''
            WHERE rr.match_type = 'title'
              AND (rr.expires_at IS NULL OR rr.expires_at > NOW())
              AND (
                r.is_system
                OR EXISTS (
                    SELECT 1 FROM role_permission_codes p
                    WHERE p.role_id = r.id AND p.permission_code = 'feedback:process'
                )
              )
        ) candidate
        WHERE lower(candidate.login) = lower($1)
        LIMIT 1
        `,
        [login.trim()]
    );
    if (!rows[0]) {
        throw new ContentError("Этому сотруднику нельзя назначить обращение");
    }
    return rows[0].login;
}

async function assigneeDisplayName(login: string): Promise<string> {
    const rows = await db.query<{ name: string }>(
        `
        SELECT COALESCE(
            NULLIF(btrim(employee.name), ''),
            $1
        ) AS name
        FROM (SELECT $1::varchar AS login) seed
        LEFT JOIN employees employee ON lower(employee.login) = lower(seed.login)
        `,
        [login]
    );
    return rows[0]?.name ?? login;
}

function handlingText(action: "take" | "assign" | "status", status: FeedbackStatus, assigneeName: string, note: string): string {
    const line = action === "take"
        ? "Обращение взято в работу."
        : action === "assign"
            ? `Назначен ответственный: ${assigneeName}.`
            : `Статус: ${FEEDBACK_STATUS_LABELS[status]}.`;
    return note ? `${line}\n${note}` : line;
}

async function messageChange(
    access: AccessView,
    ticket: { status: FeedbackStatus; assignee: string | null },
    requestedStatus: string | null,
    action: string | null,
    assignee: string | null,
): Promise<{ status: FeedbackStatus; assignee: string | null } | null> {
    if (!can(access, "feedback:process")) {
        return null;
    }
    if (action === "take") {
        return { status: "progress", assignee: access.username };
    }
    if (action === "assign") {
        return { status: "progress", assignee: await processorLogin(access, { assignee }) };
    }
    const next = messageStatus(access, ticket.status, requestedStatus);
    return next ? { status: next, assignee: ticket.assignee } : null;
}

function actionField(body: unknown): "take" | "assign" | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const action = (body as Record<string, unknown>).action;
    return action === "take" || action === "assign" ? action : null;
}

function textField(body: unknown, key: string): string | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const value = (body as Record<string, unknown>)[key];
    return typeof value === "string" && value.trim() !== "" ? value : null;
}

function messageStatus(access: AccessView, current: FeedbackStatus, requested: string | null): FeedbackStatus | null {
    if (!requested || !can(access, "feedback:process")) {
        return null;
    }
    if (!isFeedbackStatus(requested)) {
        throw new ContentError("Выберите статус");
    }
    return requested === current ? null : requested;
}

function statusField(body: unknown): string | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const status = (body as Record<string, unknown>).status;
    return typeof status === "string" && status.trim() !== "" ? status : null;
}

function readStatus(body: unknown): FeedbackStatus | null {
    if (!body || typeof body !== "object") {
        return null;
    }
    const status = (body as Record<string, unknown>).status;
    return isFeedbackStatus(status) ? status : null;
}
