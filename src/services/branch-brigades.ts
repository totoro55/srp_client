import { randomUUID } from "node:crypto";
import type { QueryResultRow } from "pg";
import { db } from "@/services/db";
import { moscowToday } from "@/services/segment-locks";

const PERIOD = /^\d{4}-\d{2}-01$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 80;

export type BrigadeMode = "off" | "all" | "groups";

export interface BrigadeGroupRecord {
    id: string;
    name: string;
    memberIds: string[];
}

export interface BrigadeSetupRecord {
    mode: BrigadeMode;
    groups: BrigadeGroupRecord[];
    /** Месяц, с которого действует этот режим. null — строки ещё не было, режим выключен. */
    since: string | null;
}

export class BrigadeSetupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BrigadeSetupError";
    }
}

const EMPTY_SETUP: BrigadeSetupRecord = { mode: "off", groups: [], since: null };

type PremiumQuery = <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

export async function readBranchBrigadeSetup(branchId: string, period: string): Promise<BrigadeSetupRecord> {
    if (!UUID.test(branchId) || !PERIOD.test(period)) {
        return EMPTY_SETUP;
    }
    return readEffective((sql, params) => db.query(sql, params), branchId.toLowerCase(), period, true);
}

export function parseBrigadeSetup(value: unknown): BrigadeSetupRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const body = value as { mode?: unknown; groups?: unknown };
    if (body.mode !== "off" && body.mode !== "all" && body.mode !== "groups") {
        return null;
    }
    if (!Array.isArray(body.groups)) {
        return null;
    }
    const groups: BrigadeGroupRecord[] = [];
    const seenEmployees = new Set<string>();
    for (const item of body.groups) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
        }
        const group = item as { name?: unknown; memberIds?: unknown };
        if (typeof group.name !== "string") {
            return null;
        }
        const name = group.name.trim();
        if (name === "" || name.length > NAME_MAX) {
            return null;
        }
        if (!Array.isArray(group.memberIds)) {
            return null;
        }
        const memberIds: string[] = [];
        for (const member of group.memberIds) {
            if (typeof member !== "string" || !UUID.test(member)) {
                return null;
            }
            const id = member.toLowerCase();
            if (seenEmployees.has(id)) {
                continue;
            }
            seenEmployees.add(id);
            memberIds.push(id);
        }
        groups.push({ id: randomUUID(), name, memberIds });
    }
    if (groups.length > 40) {
        return null;
    }
    return { mode: body.mode, groups, since: null };
}

export async function saveBranchBrigadeSetup(
    branchId: string,
    period: string,
    setup: BrigadeSetupRecord,
): Promise<{ setup: BrigadeSetupRecord; periods: string[] }> {
    if (!UUID.test(branchId) || !PERIOD.test(period)) {
        throw new BrigadeSetupError("Укажите филиал и месяц");
    }
    const branch = branchId.toLowerCase();
    const periods = await db.transaction(async (query) => storeEffective(query, branch, period, setup));
    return { setup: await readBranchBrigadeSetup(branch, period), periods };
}

/** Месяцы от выбранного до текущего, пока режим не перекрыт более поздней записью. Будущий месяц в список не входит. */
export function brigadeCarryMonths(start: string, nextPeriod: string | null, today: string): string[] {
    if (!PERIOD.test(start) || !PERIOD.test(`${today.slice(0, 7)}-01`)) {
        return [];
    }
    const current = `${today.slice(0, 7)}-01`;
    const stop = nextPeriod && PERIOD.test(nextPeriod) && nextPeriod <= current ? nextPeriod : addMonth(current);
    const months: string[] = [];
    let cursor = start;
    while (cursor < stop && cursor <= current) {
        months.push(cursor);
        cursor = addMonth(cursor);
    }
    return months;
}

/** Читает режим бригады филиалов, действующий в месяце. Нет более ранней строки — off. */
export async function readBranchBrigadeModes(
    period: string,
    branchIds: readonly string[],
): Promise<Map<string, BrigadeMode>> {
    const modes = new Map<string, BrigadeMode>();
    const ids = [...new Set(branchIds.map((id) => id.toLowerCase()).filter((id) => UUID.test(id)))];
    for (const id of ids) {
        modes.set(id, "off");
    }
    if (!PERIOD.test(period) || ids.length === 0) {
        return modes;
    }
    const rows = await db.query<{ branchId: string; mode: string }>(
        `
        SELECT DISTINCT ON (branch_uuid)
               branch_uuid::text AS "branchId",
               mode
        FROM main.branch_brigades
        WHERE period <= $1::date
          AND branch_uuid = ANY($2::uuid[])
        ORDER BY branch_uuid, period DESC
        `,
        [period, ids],
    );
    for (const row of rows) {
        if (row.mode === "off" || row.mode === "all" || row.mode === "groups") {
            modes.set(row.branchId.toLowerCase(), row.mode);
        }
    }
    return modes;
}

/**
 * Включает или выключает полную бригаду (режим all), группы не трогает.
 * false при режиме groups оставляет groups.
 * Возвращает месяцы, в которых действующий режим изменился.
 */
export async function writeBranchBrigadeFullMode(
    query: PremiumQuery,
    branchId: string,
    period: string,
    full: boolean,
): Promise<string[]> {
    if (!UUID.test(branchId) || !PERIOD.test(period)) {
        throw new BrigadeSetupError("Укажите филиал и месяц");
    }
    const branch = branchId.toLowerCase();
    const current = await readEffective(query, branch, period, true);
    if (full) {
        if (current.mode === "all") {
            return [];
        }
        return storeEffective(query, branch, period, { mode: "all", groups: current.groups, since: current.since });
    }
    if (current.mode !== "all") {
        return [];
    }
    return storeEffective(query, branch, period, { mode: "off", groups: current.groups, since: current.since });
}

async function readEffective(
    query: PremiumQuery,
    branchId: string,
    period: string,
    inclusive: boolean,
): Promise<BrigadeSetupRecord> {
    const rows = await query<{ since: string; mode: string; groupId: string | null; name: string | null; employeeId: string | null }>(
        `
        SELECT to_char(setup.period, 'YYYY-MM-DD') AS since,
               setup.mode,
               grp.id::text AS "groupId",
               grp.name,
               member.employee_uuid::text AS "employeeId"
        FROM main.branch_brigades setup
        LEFT JOIN main.branch_brigade_groups grp
            ON grp.branch_uuid = setup.branch_uuid
           AND grp.period = setup.period
        LEFT JOIN main.branch_brigade_members member
            ON member.group_id = grp.id
        WHERE setup.branch_uuid = $1::uuid
          AND setup.period = (
              SELECT earlier.period
              FROM main.branch_brigades earlier
              WHERE earlier.branch_uuid = $1::uuid
                AND earlier.period ${inclusive ? "<=" : "<"} $2::date
              ORDER BY earlier.period DESC
              LIMIT 1
          )
        ORDER BY grp.sort_order, member.employee_uuid
        `,
        [branchId, period],
    );
    return rowsToSetup(rows);
}

/** Пишет границу месяца, только если режим отличается от уже действующего. Совпадение с предыдущей границей стирает запись этого месяца. */
async function storeEffective(
    query: PremiumQuery,
    branchId: string,
    period: string,
    next: BrigadeSetupRecord,
): Promise<string[]> {
    const effective = await readEffective(query, branchId, period, true);
    if (sameSetup(next, effective)) {
        return [];
    }
    const predecessor = await readEffective(query, branchId, period, false);
    const boundary = await query<{ period: string }>(
        `
        SELECT to_char(period, 'YYYY-MM-DD') AS period
        FROM main.branch_brigades
        WHERE branch_uuid = $1::uuid
          AND period > $2::date
        ORDER BY period
        LIMIT 1
        `,
        [branchId, period],
    );
    const periods = brigadeCarryMonths(period, boundary[0]?.period ?? null, moscowToday());
    if (sameSetup(next, predecessor)) {
        await query(
            `
            DELETE FROM main.branch_brigades
            WHERE branch_uuid = $1::uuid
              AND period = $2::date
            `,
            [branchId, period],
        );
        return periods;
    }
    await writeSetup(query, branchId, period, next);
    return periods;
}

function sameSetup(left: BrigadeSetupRecord, right: BrigadeSetupRecord): boolean {
    if (left.mode !== right.mode || left.groups.length !== right.groups.length) {
        return false;
    }
    return left.groups.every((group, index) => {
        const other = right.groups[index];
        if (!other || group.name !== other.name || group.memberIds.length !== other.memberIds.length) {
            return false;
        }
        const members = [...group.memberIds].sort();
        const rest = [...other.memberIds].sort();
        return members.every((id, memberIndex) => id === rest[memberIndex]);
    });
}

function addMonth(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const date = new Date(Date.UTC(year, month, 1));
    const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${date.getUTCFullYear()}-${nextMonth}-01`;
}

async function writeSetup(
    query: PremiumQuery,
    branchId: string,
    period: string,
    setup: BrigadeSetupRecord,
): Promise<void> {
    await query(
        `
        INSERT INTO main.branch_brigades (branch_uuid, period, mode)
        VALUES ($1::uuid, $2::date, $3)
        ON CONFLICT (branch_uuid, period) DO UPDATE
            SET mode = EXCLUDED.mode
        `,
        [branchId, period, setup.mode],
    );
    await query(
        `
        DELETE FROM main.branch_brigade_groups
        WHERE branch_uuid = $1::uuid
          AND period = $2::date
        `,
        [branchId, period],
    );
    for (const [index, group] of setup.groups.entries()) {
        await query(
            `
            INSERT INTO main.branch_brigade_groups (id, branch_uuid, period, name, sort_order)
            VALUES ($1::uuid, $2::uuid, $3::date, $4, $5)
            `,
            [group.id, branchId, period, group.name, index],
        );
        if (group.memberIds.length === 0) {
            continue;
        }
        await query(
            `
            INSERT INTO main.branch_brigade_members (group_id, employee_uuid)
            SELECT $1::uuid, member.id::uuid
            FROM unnest($2::text[]) AS member(id)
            `,
            [group.id, group.memberIds],
        );
    }
}

function rowsToSetup(rows: { since?: string; mode: string; groupId: string | null; name: string | null; employeeId: string | null }[]): BrigadeSetupRecord {
    const mode = rows[0]?.mode;
    if (mode !== "off" && mode !== "all" && mode !== "groups") {
        return EMPTY_SETUP;
    }
    const since = rows[0]?.since && PERIOD.test(rows[0].since) ? rows[0].since : null;
    const groups = new Map<string, BrigadeGroupRecord>();
    for (const row of rows) {
        if (!row.groupId || !row.name) {
            continue;
        }
        const group = groups.get(row.groupId) ?? { id: row.groupId, name: row.name, memberIds: [] };
        if (row.employeeId) {
            group.memberIds.push(row.employeeId.toLowerCase());
        }
        groups.set(row.groupId, group);
    }
    return { mode, groups: [...groups.values()], since };
}
