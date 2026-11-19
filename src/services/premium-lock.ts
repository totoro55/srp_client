import { Client } from "pg";

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
