import type { AccessView } from "@/server/authz/resolve-access";
import { ContentError } from "@/services/content-error";
import { db } from "@/services/db";

export interface AppNotification {
    id: number;
    kind: string;
    body: string;
    href: string;
    createdAt: string;
    readAt: string | null;
}

export interface NotificationFeed {
    unread: number;
    items: AppNotification[];
}

const FEED_LIMIT = 100;

const PROCESSORS = `
    SELECT DISTINCT ON (lower(candidate.login)) candidate.login
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
    WHERE btrim(candidate.login) <> ''
    ORDER BY lower(candidate.login), candidate.login
`;

export async function notifyFeedback(input: {
    actor: string;
    ticketId: number;
    subject: string;
    author: string;
    assignee: string | null;
    event: "created" | "reply";
}): Promise<void> {
    const actor = input.actor.toLowerCase();
    const authorIsActor = input.author.toLowerCase() === actor;
    let recipients: string[];
    if (input.event === "created" || authorIsActor) {
        recipients = input.event === "reply" && input.assignee
            ? [input.assignee]
            : (await db.query<{ login: string }>(PROCESSORS)).map((row) => row.login);
    } else {
        recipients = [input.author];
    }
    const unique = new Map<string, string>();
    for (const login of recipients) {
        const key = login.toLowerCase();
        if (key === actor || unique.has(key)) {
            continue;
        }
        unique.set(key, login);
    }
    if (unique.size === 0) {
        return;
    }
    const subject = clip(input.subject);
    const body = input.event === "created"
        ? `Новое обращение №${input.ticketId}: ${subject}`
        : authorIsActor
            ? `Новый ответ в обращении №${input.ticketId}: ${subject}`
            : `Ответ по обращению №${input.ticketId}: ${subject}`;
    await db.query(
        `
        INSERT INTO app_notifications (recipient, kind, body, href, source_key)
        SELECT login, 'feedback', $2, $3, $4
        FROM unnest($1::varchar[]) AS login
        `,
        [[...unique.values()], body, `/feedback/${input.ticketId}`, `feedback:${input.ticketId}`]
    );
}

export async function markFeedbackSeen(username: string, ticketId: number): Promise<void> {
    const login = username.toLowerCase();
    await db.query(
        `
        INSERT INTO feedback_visits (ticket_id, username, seen_message_id, opened_at)
        VALUES (
            $1,
            $2,
            COALESCE((SELECT MAX(id) FROM feedback_messages WHERE ticket_id = $1), 0),
            NOW()
        )
        ON CONFLICT (ticket_id, username) DO UPDATE
        SET seen_message_id = GREATEST(
                feedback_visits.seen_message_id,
                EXCLUDED.seen_message_id
            ),
            opened_at = NOW()
        `,
        [ticketId, login]
    );
    await db.query(
        `
        UPDATE app_notifications
        SET read_at = NOW()
        WHERE lower(recipient) = $1
          AND source_key = $2
          AND read_at IS NULL
        `,
        [login, `feedback:${ticketId}`]
    );
}

export async function listNotifications(access: AccessView): Promise<NotificationFeed> {
    const login = access.username.toLowerCase();
    const counts = await db.query<{ unread: number }>(
        `
        SELECT COUNT(*)::int AS unread
        FROM app_notifications
        WHERE lower(recipient) = $1 AND read_at IS NULL
        `,
        [login]
    );
    const rows = await db.query<{
        id: number;
        kind: string;
        body: string;
        href: string;
        created_at: Date;
        read_at: Date | null;
    }>(
        `
        SELECT id, kind, body, href, created_at, read_at
        FROM app_notifications
        WHERE lower(recipient) = $1
        ORDER BY id DESC
        LIMIT ${FEED_LIMIT}
        `,
        [login]
    );
    return {
        unread: counts[0]?.unread ?? 0,
        items: rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            body: row.body,
            href: row.href,
            createdAt: new Date(row.created_at).toISOString(),
            readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
        })),
    };
}

export async function readNotifications(access: AccessView, body: unknown): Promise<NotificationFeed> {
    const login = access.username.toLowerCase();
    const record = body && typeof body === "object" ? body as { all?: unknown; id?: unknown; read?: unknown } : null;
    if (record?.all === true) {
        await db.query(
            `
            UPDATE app_notifications
            SET read_at = NOW()
            WHERE lower(recipient) = $1 AND read_at IS NULL
            `,
            [login]
        );
        return listNotifications(access);
    }
    const id = record?.id;
    if (!record || typeof id !== "number" || !Number.isInteger(id)) {
        throw new ContentError("Выберите уведомление");
    }
    if (record.read === false) {
        await db.query(
            `
            UPDATE app_notifications
            SET read_at = NULL
            WHERE lower(recipient) = $1
              AND (
                id = $2
                OR (
                    source_key IS NOT NULL
                    AND source_key = (
                        SELECT source_key FROM app_notifications
                        WHERE id = $2 AND lower(recipient) = $1
                    )
                )
              )
            `,
            [login, id]
        );
        return listNotifications(access);
    }
    const rows = await db.query<{ source_key: string | null }>(
        `
        UPDATE app_notifications
        SET read_at = NOW()
        WHERE lower(recipient) = $1
          AND read_at IS NULL
          AND (
            id = $2
            OR source_key = (
                SELECT source_key FROM app_notifications
                WHERE id = $2 AND lower(recipient) = $1
            )
          )
        RETURNING source_key
        `,
        [login, id]
    );
    if (record.read !== true) {
        const source = rows.find((row) => row.source_key?.startsWith("feedback:"))?.source_key;
        const ticketId = source ? Number(source.slice("feedback:".length)) : NaN;
        if (Number.isInteger(ticketId)) {
            await markFeedbackSeen(access.username, ticketId);
        }
    }
    return listNotifications(access);
}

function clip(text: string): string {
    const line = text.trim().replace(/\s+/g, " ");
    if (line.length <= 80) {
        return line;
    }
    return `${line.slice(0, 79)}…`;
}
