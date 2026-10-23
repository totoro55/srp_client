import { randomUUID } from "crypto";
import {
    FEEDBACK_BODY_MAX,
    FEEDBACK_MESSAGE_MAX,
    FEEDBACK_STATUS_LABELS,
    FEEDBACK_SUBJECT_MAX,
    boundedText,
    isFeedbackStatus,
    type FeedbackListScope,
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

export interface FeedbackTicket {
    id: number;
    author: string;
    subject: string;
    body: string;
    status: FeedbackStatus;
    assignee: string | null;
    assigneeName: string | null;
    createdAt: string;
    updatedAt: string;
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
    body: string;
    createdAt: string;
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
    subject: string;
    body: string;
    status: FeedbackStatus;
    assignee: string | null;
    assignee_name: string | null;
    created_at: Date;
    updated_at: Date;
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
            SELECT 1 FROM feedback_messages
            WHERE ticket_id = ticket.id AND body ILIKE $4 ESCAPE '\\'
        )
      )
      AND (
        $5 = 'all'
        OR ($5 = 'open' AND ticket.status IN ('new', 'progress', 'waiting'))
        OR ticket.status = $5
      )
`;

const ASSIGNEE_NAME = `
    COALESCE(
        NULLIF(btrim(employee.name), ''),
        NULLIF(btrim(account.display_name), ''),
        ticket.assignee
    )
`;

export async function listFeedback(access: AccessView, query: string, scope: FeedbackListScope, requestedPage: number): Promise<FeedbackListPage> {
    const processor = can(access, "feedback:process");
    const filterParams = [processor, access.username, query, likePattern(query), scope];
    const totals = await db.query<{ total: number }>(
        `SELECT COUNT(*)::int AS total FROM feedback_tickets ticket ${FEEDBACK_FILTER}`,
        filterParams
    );
    const total = totals[0]?.total ?? 0;
    const page = Math.min(requestedPage, pageCount(total, ADMIN_PAGE_SIZE));
    const rows = await db.query<TicketRow>(
        `
        SELECT ticket.id, ticket.author, ticket.subject, ticket.body, ticket.status,
               ticket.assignee, ${ASSIGNEE_NAME} AS assignee_name,
               ticket.created_at, ticket.updated_at
        FROM feedback_tickets ticket
        LEFT JOIN employees employee ON lower(employee.login) = lower(ticket.assignee)
        LEFT JOIN users account ON lower(account.username) = lower(ticket.assignee)
        ${FEEDBACK_FILTER}
        ORDER BY ticket.updated_at DESC, ticket.id DESC
        LIMIT $6 OFFSET $7
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
    const input = readTicket(body);
    const rows = await db.query<{ id: number }>(
        "INSERT INTO feedback_tickets (author, subject, body) VALUES ($1, $2, $3) RETURNING id",
        [access.username, input.subject, input.body]
    );
    const id = rows[0].id;
    try {
        await addFeedbackFiles(access, id, null, files);
    } catch (error) {
        await db.query("DELETE FROM feedback_tickets WHERE id = $1", [id]);
        throw error;
    }
    return getFeedback(access, id);
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
    return getFeedback(access, id);
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
                       NULLIF(btrim(account.display_name), ''),
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
            LEFT JOIN users account ON lower(account.username) = lower(candidate.login)
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
    return getFeedback(access, id);
}

async function loadTicket(id: number): Promise<TicketRow & { messages?: never }> {
    const rows = await db.query<TicketRow>(
        `
        SELECT ticket.id, ticket.author, ticket.subject, ticket.body, ticket.status,
               ticket.assignee, ${ASSIGNEE_NAME} AS assignee_name,
               ticket.created_at, ticket.updated_at
        FROM feedback_tickets ticket
        LEFT JOIN employees employee ON lower(employee.login) = lower(ticket.assignee)
        LEFT JOIN users account ON lower(account.username) = lower(ticket.assignee)
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
    const rows = await db.query<{ id: number; author: string; body: string; created_at: Date }>(
        "SELECT id, author, body, created_at FROM feedback_messages WHERE ticket_id = $1 AND id > $2 ORDER BY id",
        [ticketId, after]
    );
    return rows.map((row) => ({
        id: row.id,
        author: row.author,
        body: row.body,
        createdAt: new Date(row.created_at).toISOString(),
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
        subject: row.subject,
        body: row.body,
        status: row.status,
        assignee: row.assignee,
        assigneeName: row.assignee_name,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
    };
}

function readTicket(body: unknown): { subject: string; body: string } {
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
    return { subject, body: text };
}

function readMessage(body: unknown): string {
    if (!body || typeof body !== "object") {
        throw new ContentError("Напишите ответ");
    }
    const text = boundedText((body as Record<string, unknown>).body, FEEDBACK_MESSAGE_MAX, "Ответ");
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
            NULLIF(btrim(account.display_name), ''),
            $1
        ) AS name
        FROM (SELECT $1::varchar AS login) seed
        LEFT JOIN employees employee ON lower(employee.login) = lower(seed.login)
        LEFT JOIN users account ON lower(account.username) = lower(seed.login)
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
