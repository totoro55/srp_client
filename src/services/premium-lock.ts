import { Client } from "pg";
import { db } from "@/services/db";

/** Один пересчёт премии на базу. Второй месяц ждёт, а не идёт рядом. */
const PREMIUM_TURN = 82420037;

export async function withPremiumTurn<T>(work: () => Promise<T>): Promise<T> {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        options: "-c search_path=public,dictionaries,raw,main,basket_data",
    });
    await client.connect();
    try {
        await client.query("SELECT pg_advisory_lock($1)", [PREMIUM_TURN]);
        try {
            return await work();
        } finally {
            await client.query("SELECT pg_advisory_unlock($1)", [PREMIUM_TURN]);
        }
    } finally {
        await client.end();
    }
}

/**
 * Снимает зависший ход премии.
 * Ожидающий месяц только ждёт блокировку: его сессия ещё не держит замок.
 * Если другого идущего запуска нет, гасится и сессия, которая держит замок, но уже ничего не считает.
 */
export async function interruptPremiumTurn(options?: { releaseHolder?: boolean }): Promise<void> {
    const releaseHolder = options?.releaseHolder !== false;
    await db.query(
        `
        SELECT pg_cancel_backend(activity.pid)
        FROM pg_locks turn
        JOIN pg_stat_activity activity ON activity.pid = turn.pid
        WHERE turn.locktype = 'advisory'
          AND turn.classid = 0
          AND turn.objid = $1
          AND activity.datname = current_database()
          AND activity.pid <> pg_backend_pid()
          AND NOT turn.granted
        `,
        [PREMIUM_TURN],
    );
    if (!releaseHolder) {
        return;
    }
    await db.query(
        `
        SELECT pg_cancel_backend(activity.pid)
        FROM pg_stat_activity activity
        WHERE activity.datname = current_database()
          AND activity.pid <> pg_backend_pid()
          AND activity.state = 'active'
          AND EXISTS (
              SELECT 1
              FROM pg_locks turn
              WHERE turn.locktype = 'advisory'
                AND turn.classid = 0
                AND turn.objid = $1
                AND turn.granted
          )
          AND (
              activity.query ILIKE '%author_days%'
              OR activity.query ILIKE '%basket_premium_days%'
              OR activity.query ILIKE '%vystavleniye%'
              OR activity.query ILIKE '%closed_staff_segments%'
              OR activity.query ILIKE '%raw.hr_ktu%'
          )
        `,
        [PREMIUM_TURN],
    );
    await db.query(
        `
        SELECT pg_terminate_backend(activity.pid)
        FROM pg_locks turn
        JOIN pg_stat_activity activity ON activity.pid = turn.pid
        WHERE turn.locktype = 'advisory'
          AND turn.classid = 0
          AND turn.objid = $1
          AND turn.granted
          AND activity.datname = current_database()
          AND activity.pid <> pg_backend_pid()
          AND activity.state = 'idle'
        `,
        [PREMIUM_TURN],
    );
}
