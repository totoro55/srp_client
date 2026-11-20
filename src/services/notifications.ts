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

export interface NotificationSummary {
    unread: number;
    latestId: number | null;
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
        JOIN employees employee ON employee.title = rr.match_value
            AND btrim(employee.login) <> ''
            AND NOT employee.deleted
            AND (employee.territory_uuid IS NOT NULL OR employee.branch_uuid IS NOT NULL)
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

const RECALC_PROBLEM = /^(Пересчёт премии остановился|Пересчёт премии отменён|Тарифы продажи не записаны|Тарифы продажи отменены)/;

async function unreadRecalc(login: string): Promise<{ id: number; body: string }[]> {
    return db.query<{ id: number; body: string }>(
        `
        SELECT id, body
        FROM app_notifications
        WHERE lower(recipient) = $1 AND kind = 'recalc' AND read_at IS NULL
        ORDER BY id DESC
        `,
        [login],
    );
}

/** Одно непрочитанное об окончании и одно об ошибке или отмене. Остальные такие записи убирает. */
async function foldUnreadRecalc(login: string): Promise<void> {
    const rows = await unreadRecalc(login);
    if (rows.length < 2) {
        return;
    }
    const success = rows.find((row) => !recalcNoticeIsProblem(row.body));
    const problem = rows.find((row) => recalcNoticeIsProblem(row.body));
    const keep = new Set<number>();
    if (success) {
        keep.add(success.id);
    }
    if (problem) {
        keep.add(problem.id);
    }
    const drop = rows.filter((row) => !keep.has(row.id)).map((row) => row.id);
    if (drop.length === 0) {
        return;
    }
    await db.query(
        `DELETE FROM app_notifications WHERE id = ANY($1::int[])`,
        [drop],
    );
}

export function recalcNoticeIsProblem(body: string): boolean {
    return RECALC_PROBLEM.test(body) || body.includes("с ошибкой");
}

export async function notifyRecalc(input: {
    actor: string;
    body: string;
    href: string;
    runId: number;
    sourceKey?: string;
}): Promise<void> {
    const actor = input.actor.trim();
    if (actor === "" || actor.toLowerCase() === "airflow") {
        return;
    }
    const login = actor.toLowerCase();
    const sourceKey = input.sourceKey ?? `recalc:${input.runId}`;
    const problem = recalcNoticeIsProblem(input.body);
    const unread = await unreadRecalc(login);
    const current = unread.find((row) => recalcNoticeIsProblem(row.body) === problem);
    if (current) {
        await db.query(
            `
            UPDATE app_notifications
            SET body = $2, href = $3, source_key = $4, created_at = NOW()
            WHERE id = $1
            `,
            [current.id, input.body, input.href, sourceKey],
        );
    } else {
        await db.query(
            `
            INSERT INTO app_notifications (recipient, kind, body, href, source_key)
            VALUES ($1, 'recalc', $2, $3, $4)
            `,
            [actor, input.body, input.href, sourceKey],
        );
    }
    await foldUnreadRecalc(login);
}

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

export async function summarizeNotifications(access: AccessView): Promise<NotificationSummary> {
    const login = access.username.toLowerCase();
    await foldUnreadRecalc(login);
    const rows = await db.query<{ unread: number; latest_id: number | null }>(
        `
        SELECT
            COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread,
            MAX(id)::int AS latest_id
        FROM app_notifications
        WHERE lower(recipient) = $1
        `,
        [login],
    );
    return {
        unread: rows[0]?.unread ?? 0,
        latestId: rows[0]?.latest_id ?? null,
    };
}

export async function listNotifications(access: AccessView): Promise<NotificationFeed> {
    const login = access.username.toLowerCase();
    await foldUnreadRecalc(login);
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
        items: visibleNotifications(rows.map((row) => ({
            id: row.id,
            kind: row.kind,
            body: row.body,
            href: row.href,
            createdAt: new Date(row.created_at).toISOString(),
            readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
        }))),
    };
}

function visibleNotifications(items: AppNotification[]): AppNotification[] {
    let success = false;
    let problem = false;
    const hidden = new Set<number>();
    for (const item of items) {
        if (item.kind !== "recalc") {
            continue;
        }
        if (recalcNoticeIsProblem(item.body)) {
            if (problem) {
                hidden.add(item.id);
            }
            problem = true;
            continue;
        }
        if (success) {
            hidden.add(item.id);
        }
        success = true;
    }
    return items.filter((item) => !hidden.has(item.id));
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
