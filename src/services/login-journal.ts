import type { QueryResultRow } from "pg";
import type { LoginFailureReason } from "@/lib/login-journal";
import { decideAccess } from "@/server/authz/match-access";
import { db } from "@/services/db";

const USERNAME_LIMIT = 100;

export interface SuccessfulLogin {
    username: string;
    displayName: string;
    email: string | null;
    department: string | null;
    title: string;
    objectGuid: string | null;
    ip: string | null;
    userAgent: string | null;
}

export interface FailedLogin {
    username: string;
    reason: LoginFailureReason;
    ip: string | null;
    userAgent: string | null;
}

interface UserRow {
    id: number;
    title: string;
}

export async function recordSuccessfulLogin(input: SuccessfulLogin): Promise<void> {
    const username = clip(input.username.trim(), USERNAME_LIMIT);
    if (!username) {
        return;
    }

    try {
        await writeSuccessfulLogin({ ...input, username });
    } catch (error) {
        if (!isUniqueViolation(error)) {
            console.error("Не удалось записать вход:", error);
            return;
        }

        try {
            await writeSuccessfulLogin({ ...input, username });
        } catch (retryError) {
            console.error("Не удалось записать вход:", retryError);
        }
    }
}

export async function recordFailedLogin(input: FailedLogin): Promise<void> {
    const username = clip(input.username.trim(), USERNAME_LIMIT);
    if (!username) {
        return;
    }

    try {
        const existing = await db.query<{ id: number }>(
            "SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1",
            [username]
        );
        await db.query(
            `
            INSERT INTO login_events (
                user_id, username, success, ip, user_agent, failure_reason
            )
            VALUES ($1, $2, false, $3, $4, $5)
            `,
            [existing[0]?.id ?? null, username, input.ip, input.userAgent, input.reason]
        );
    } catch (error) {
        console.error("Не удалось записать отказ входа:", error);
    }
}

async function writeSuccessfulLogin(input: SuccessfulLogin): Promise<void> {
    const decision = await decideAccess(input.username, input.title);
    const department = blankToNull(input.department);
    const email = blankToNull(input.email);
    const title = clip(input.title.trim(), 255);
    const displayName = clip(input.displayName.trim() || input.username, 255);

    await db.transaction(async (query) => {
        const existing = await findUser(query, input.username, input.objectGuid);
        const titleChanged = existing !== null && existing.title !== "" && existing.title !== title;
        const userId = existing
            ? await updateUser(query, existing.id, {
                ...input,
                displayName,
                email,
                department,
                title,
            })
            : await insertUser(query, {
                ...input,
                displayName,
                email,
                department,
                title,
            });

        await query(
            `
            INSERT INTO login_events (
                user_id, username, success, ip, user_agent, title, department,
                access_source, role_id, role_name, title_changed
            )
            VALUES ($1, $2, true, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [
                userId,
                input.username,
                input.ip,
                input.userAgent,
                title,
                department,
                decision.source,
                decision.role?.id ?? null,
                decision.role ? clip(decision.role.name, 100) : null,
                titleChanged,
            ]
        );
    });
}

async function findUser(
    query: Query,
    username: string,
    objectGuid: string | null
): Promise<UserRow | null> {
    if (objectGuid) {
        const byGuid = await query<UserRow>(
            "SELECT id, title FROM users WHERE object_guid = $1 FOR UPDATE",
            [objectGuid]
        );
        if (byGuid[0]) {
            return byGuid[0];
        }
    }

    const byName = await query<UserRow>(
        "SELECT id, title FROM users WHERE lower(username) = lower($1) FOR UPDATE",
        [username]
    );
    return byName[0] ?? null;
}

async function updateUser(query: Query, id: number, input: SuccessfulLogin): Promise<number> {
    await query(
        `
        UPDATE users
        SET username = $2,
            display_name = $3,
            email = $4,
            department = $5,
            title = $6,
            object_guid = COALESCE($7::uuid, object_guid),
            last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [id, input.username, input.displayName, input.email, input.department, input.title, input.objectGuid]
    );
    return id;
}

async function insertUser(query: Query, input: SuccessfulLogin): Promise<number> {
    const rows = await query<{ id: number }>(
        `
        INSERT INTO users (
            object_guid, username, display_name, email, department, title, first_login_at, last_login_at
        )
        VALUES ($1::uuid, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
        `,
        [input.objectGuid, input.username, input.displayName, input.email, input.department, input.title]
    );
    return rows[0].id;
}

type Query = <T extends QueryResultRow>(text: string, params?: unknown[]) => Promise<T[]>;

function blankToNull(value: string | null): string | null {
    const trimmed = value?.trim() ?? "";
    return trimmed ? clip(trimmed, 255) : null;
}

function clip(value: string, limit: number): string {
    return value.length > limit ? value.slice(0, limit) : value;
}

function isUniqueViolation(error: unknown): boolean {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && (error as { code: unknown }).code === "23505";
}
