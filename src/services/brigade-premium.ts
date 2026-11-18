import type { QueryResultRow } from "pg";
import {
    BRIGADE_INDICATORS,
    isBrigadeIndicator,
    splitBrigadePool,
    type BrigadeIndicator,
    type BrigadePoolSegment,
} from "@/lib/brigade-shares";
import { automaticRole, type MotivationSettings, type RuleKtu } from "@/lib/motivation-roles";
import { db } from "@/services/db";
import { SalePremiumError, type PremiumRun } from "@/services/sale-premium";
import { moscowToday, monthBefore, prepareClosedSegments } from "@/services/segment-locks";
import { premiumsBySegment, staffSegments, type BranchStaffRow, type HourDay, type StaffVersion } from "@/services/staff-segments";

type PremiumQuery = <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

const PERIOD = /^\d{4}-\d{2}-01$/;

interface BrigadeSetupRow {
    branchId: string;
    mode: "off" | "all" | "groups";
    territoryId: string;
}

interface BrigadeMemberRow {
    branchId: string;
    groupId: string;
    employeeId: string;
}

interface StoredShare {
    branchId: string;
    employeeId: string;
    activeFrom: string;
    premium: number;
}

interface Span {
    branchId: string;
    employeeId: string;
    from: string;
    until: string;
}

interface VersionRow extends StaffVersion {
    inMonth: boolean;
}

export async function calculateBrigadePremium(
    period: string,
    indicator: BrigadeIndicator,
    run?: PremiumRun,
): Promise<number> {
    return calculateBrigadePremiums(period, [indicator], run);
}

/** Переписывает доли перечисленных корзин. Состав и дни корзин уже записаны. */
export async function calculateBrigadePremiums(
    period: string,
    indicators: readonly BrigadeIndicator[],
    run?: PremiumRun,
): Promise<number> {
    if (!PERIOD.test(period) || indicators.length === 0 || indicators.some((indicator) => !isBrigadeIndicator(indicator))) {
        throw new SalePremiumError("Укажите месяц и корзину бригады");
    }
    const asOf = run?.asOf ?? moscowToday();
    const earliest = run?.earliest ?? monthBefore(asOf);
    const window = run?.from && run?.until ? { from: run.from, until: run.until } : null;
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '256MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        if (window) {
            await prepareClosedSegments(query, asOf, earliest, run?.protect);
        } else {
            await prepareClosedSegments(query, asOf, earliest, run?.protect ?? ["dismissal", "transfer", "title"]);
        }
        const onlyBranch = run?.branch?.toLowerCase() ?? null;
        const listed = onlyBranch || !run?.branches ? null : run.branches.map((id) => id.toLowerCase());
        const setups = await readSetups(query, period, onlyBranch, listed);
        const members = await readMembers(query, period, onlyBranch, listed);
        const settings = await readSettings(query);
        const overrides = await readOverrides(query, period);
        const versions = await readVersions(query, period, asOf, onlyBranch);
        const days = await readTimesheet(query, period, onlyBranch);
        const premiumDays = await readPremiumDays(query, period, indicators, onlyBranch, listed);
        const stored = await readStoredShares(query, period, indicators, onlyBranch, listed);
        const accruals = await readAccrualSpans(query, period, onlyBranch, listed);
        const closed = await readClosedSpans(query);
        let written = 0;
        for (const indicator of indicators) {
            const lines = sharesForIndicator({
                period,
                setups,
                members,
                settings,
                overrides,
                versions,
                days,
                premiumDays: premiumDays.filter((day) => day.indicator === indicator),
                stored: stored.filter((share) => share.indicator === indicator),
                accruals,
                closed,
                window,
                listed,
            });
            await deleteOpenShares(query, period, indicator, onlyBranch, listed, window);
            await insertShares(query, period, indicator, lines);
            await linkAccruals(query, period, indicator, onlyBranch, listed);
            written += lines.length;
        }
        return written;
    });
}

export async function readBranchBrigadeShares(
    period: string,
    branchId: string,
): Promise<Record<BrigadeIndicator, Record<string, number>>> {
    const empty = Object.fromEntries(BRIGADE_INDICATORS.map((indicator) => [indicator, {}])) as Record<BrigadeIndicator, Record<string, number>>;
    const rows = await db.query<{ indicator: string; id: string; activeFrom: string; premium: number | string }>(
        `
        SELECT share.indicator,
               share.employee_uuid AS id,
               to_char(share.active_from, 'YYYY-MM-DD') AS "activeFrom",
               share.premium::float8 AS premium
        FROM main.brigade_premium_shares share
        WHERE share.period = $1::date
          AND share.branch_uuid = $2::uuid
        `,
        [period, branchId],
    );
    for (const row of rows) {
        if (!isBrigadeIndicator(row.indicator)) {
            continue;
        }
        const premium = amount(row.premium);
        if (premium === null) {
            continue;
        }
        empty[row.indicator][`${row.id.toLowerCase()}:${row.activeFrom}`] = premium;
    }
    return empty;
}

export interface BrigadeAudienceMember {
    id: string;
    name: string;
    segments: { from: string; until: string }[];
}

/** Участники той же бригады, что и сотрудник. null — он считается лично. */
export async function readBrigadeAudience(
    period: string,
    branchId: string,
    employeeId: string,
): Promise<BrigadeAudienceMember[] | null> {
    if (!PERIOD.test(period)) {
        return null;
    }
    const branch = branchId.toLowerCase();
    const person = employeeId.toLowerCase();
    const query: PremiumQuery = (sql, params) => db.query(sql, params);
    const setups = await readSetups(query, period, branch, null);
    const setup = setups.find((item) => item.branchId === branch);
    if (!setup || setup.mode === "off") {
        return null;
    }
    const [memberRows, settings, overrides, versions, days] = await Promise.all([
        readMembers(query, period, branch, null),
        readSettings(query),
        readOverrides(query, period),
        readVersions(query, period, moscowToday(), branch),
        readTimesheet(query, period, branch),
    ]);
    const segments = staffSegments(
        versions,
        days.filter((day) => day.branchId === branch).map((day) => ({ id: day.id, day: day.day, schedule: day.schedule, timesheet: day.timesheet })),
        branch,
        period,
    );
    const groups = new Map<string, Set<string>>();
    for (const member of memberRows) {
        const people = groups.get(member.groupId) ?? new Set<string>();
        people.add(member.employeeId);
        groups.set(member.groupId, people);
    }
    const pools = poolsOf(setup, groups, segments, overrides, settings);
    const pool = pools.find((item) => item.some((segment) => segment.id === person));
    if (!pool) {
        return null;
    }
    const byEmployee = new Map<string, BrigadeAudienceMember>();
    for (const segment of pool) {
        const current = byEmployee.get(segment.id) ?? { id: segment.id, name: segment.name, segments: [] };
        current.segments.push({ from: segment.activeFrom, until: segment.activeUntil });
        byEmployee.set(segment.id, current);
    }
    return [...byEmployee.values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
}

export function applyBrigadeShares(
    personal: Record<string, number>,
    shares: Record<string, number>,
): Record<string, number> {
    const next = { ...personal };
    for (const [key, premium] of Object.entries(shares)) {
        next[key] = premium;
    }
    return next;
}

interface ShareWrite {
    territoryId: string;
    branchId: string;
    employeeId: string;
    activeFrom: string;
    activeUntil: string;
    premium: number;
}

function sharesForIndicator(input: {
    period: string;
    setups: BrigadeSetupRow[];
    members: BrigadeMemberRow[];
    settings: MotivationSettings;
    overrides: Map<string, Map<string, string | null>>;
    versions: VersionRow[];
    days: { id: string; branchId: string; day: string; schedule: number | null; timesheet: number | null }[];
    premiumDays: { branchId: string; id: string; day: string; amount: number }[];
    stored: (StoredShare & { indicator: string })[];
    accruals: Span[];
    closed: Span[];
    window: { from: string; until: string } | null;
    listed: string[] | null;
}): ShareWrite[] {
    const listed = input.listed ? new Set(input.listed) : null;
    const membersByBranch = new Map<string, Map<string, Set<string>>>();
    for (const member of input.members) {
        const groups = membersByBranch.get(member.branchId) ?? new Map<string, Set<string>>();
        const people = groups.get(member.groupId) ?? new Set<string>();
        people.add(member.employeeId);
        groups.set(member.groupId, people);
        membersByBranch.set(member.branchId, groups);
    }
    const storedByKey = new Map<string, number>();
    for (const share of input.stored) {
        storedByKey.set(`${share.branchId}:${share.employeeId}:${share.activeFrom}`, share.premium);
    }
    const versionsByEmployee = new Map<string, VersionRow[]>();
    const employeesByBranch = new Map<string, Set<string>>();
    for (const version of input.versions) {
        const list = versionsByEmployee.get(version.id) ?? [];
        list.push(version);
        versionsByEmployee.set(version.id, list);
        if (!version.inMonth) {
            continue;
        }
        const atBranch = employeesByBranch.get(version.branchId) ?? new Set<string>();
        atBranch.add(version.id);
        employeesByBranch.set(version.branchId, atBranch);
    }
    const daysByBranch = new Map<string, HourDay[]>();
    for (const day of input.days) {
        const list = daysByBranch.get(day.branchId) ?? [];
        list.push({ id: day.id, day: day.day, schedule: day.schedule, timesheet: day.timesheet });
        daysByBranch.set(day.branchId, list);
    }
    const premiumByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    for (const day of input.premiumDays) {
        const list = premiumByBranch.get(day.branchId) ?? [];
        list.push({ id: day.id, day: day.day, amount: day.amount });
        premiumByBranch.set(day.branchId, list);
    }
    const writes: ShareWrite[] = [];
    for (const setup of input.setups) {
        if (listed && !listed.has(setup.branchId)) {
            continue;
        }
        if (setup.mode === "off" || !setup.territoryId) {
            continue;
        }
        const branchVersions: VersionRow[] = [];
        for (const employeeId of employeesByBranch.get(setup.branchId) ?? []) {
            const list = versionsByEmployee.get(employeeId);
            if (list) {
                branchVersions.push(...list);
            }
        }
        const segments = staffSegments(branchVersions, daysByBranch.get(setup.branchId) ?? [], setup.branchId, input.period);
        const personal = premiumsBySegment(segments, premiumByBranch.get(setup.branchId) ?? []);
        const pools = poolsOf(setup, membersByBranch.get(setup.branchId) ?? new Map(), segments, input.overrides, input.settings);
        for (const pool of pools) {
            const rows: BrigadePoolSegment[] = pool.map((segment) => {
                const storedShare = storedByKey.has(`${setup.branchId}:${segment.id}:${segment.activeFrom}`)
                    ? storedByKey.get(`${setup.branchId}:${segment.id}:${segment.activeFrom}`) ?? null
                    : null;
                return {
                    key: segment.rowKey,
                    employeeId: segment.id,
                    activeFrom: segment.activeFrom,
                    activeUntil: segment.activeUntil,
                    hours: segment.timesheetHours ?? 0,
                    premium: personal[segment.rowKey] ?? 0,
                    locked: segmentIsLocked(setup.branchId, segment, input.accruals, input.closed, input.window),
                    storedShare,
                };
            });
            for (const line of splitBrigadePool(rows)) {
                if (!line.write) {
                    continue;
                }
                writes.push({
                    territoryId: setup.territoryId,
                    branchId: setup.branchId,
                    employeeId: line.employeeId,
                    activeFrom: line.activeFrom,
                    activeUntil: line.activeUntil,
                    premium: line.premium,
                });
            }
        }
    }
    return writes;
}

function poolsOf(
    setup: BrigadeSetupRow,
    groups: Map<string, Set<string>>,
    segments: BranchStaffRow[],
    overrides: Map<string, Map<string, string | null>>,
    settings: MotivationSettings,
): BranchStaffRow[][] {
    const participating = segments.filter((segment) => participates(
        segment.ktu,
        roleOf(setup.branchId, segment.id, segment.title, segment.ktu, overrides, settings),
    ));
    if (setup.mode === "all") {
        return participating.length > 0 ? [participating] : [];
    }
    const pools: BranchStaffRow[][] = [];
    const claimed = new Set<string>();
    for (const people of groups.values()) {
        const pool = participating.filter((segment) => people.has(segment.id) && !claimed.has(segment.id));
        for (const segment of pool) {
            claimed.add(segment.id);
        }
        if (pool.length > 0) {
            pools.push(pool);
        }
    }
    return pools;
}

function segmentIsLocked(
    branchId: string,
    segment: BranchStaffRow,
    accruals: Span[],
    closed: Span[],
    window: { from: string; until: string } | null,
): boolean {
    if (window && (segment.activeUntil < window.from || segment.activeFrom > window.until)) {
        return true;
    }
    return spansOverlap(branchId, segment, accruals) || spansOverlap(branchId, segment, closed);
}

function spansOverlap(branchId: string, segment: BranchStaffRow, spans: Span[]): boolean {
    return spans.some((span) => (span.branchId === "" || span.branchId === branchId)
        && span.employeeId === segment.id
        && span.from <= segment.activeUntil
        && span.until >= segment.activeFrom);
}

function participates(ktu: boolean | null, roleId: string | null): boolean {
    return ktu === true || roleId !== null;
}

function roleOf(
    branchId: string,
    employeeId: string,
    title: string,
    ktu: boolean | null,
    overrides: Map<string, Map<string, string | null>>,
    settings: MotivationSettings,
): string | null {
    const manual = overrides.get(branchId);
    if (manual?.has(employeeId)) {
        return manual.get(employeeId) ?? null;
    }
    return automaticRole(title, ktu === true ? "plus" : "minus", settings);
}

async function deleteOpenShares(
    query: PremiumQuery,
    period: string,
    indicator: string,
    branchId: string | null,
    listed: string[] | null,
    window: { from: string; until: string } | null,
): Promise<void> {
    await query(
        `
        DELETE FROM main.brigade_premium_shares share
        WHERE share.period = $1::date
          AND share.indicator = $2
          AND ($3::uuid IS NULL OR share.branch_uuid = $3::uuid)
          AND ($4::uuid[] IS NULL OR share.branch_uuid = ANY($4::uuid[]))
          AND ($5::date IS NULL OR (share.active_from <= $6::date AND share.active_until >= $5::date))
          AND NOT EXISTS (
              SELECT 1
              FROM main.premium_accruals accrual
              WHERE accrual.period = share.period
                AND accrual.employee_uuid = share.employee_uuid
                AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
                AND share.active_from <= accrual.active_until
                AND share.active_until >= accrual.active_from
          )
          AND NOT EXISTS (
              SELECT 1
              FROM closed_staff_segments closed
                WHERE closed.employee_uuid = share.employee_uuid
                AND closed.branch_uuid = share.branch_uuid
                AND share.active_from <= closed.active_until
                AND share.active_until >= closed.active_from
          )
        `,
        [period, indicator, branchId, listed, window?.from ?? null, window?.until ?? null],
    );
}

async function insertShares(query: PremiumQuery, period: string, indicator: string, lines: ShareWrite[]): Promise<void> {
    const size = 500;
    for (let index = 0; index < lines.length; index += size) {
        const chunk = lines.slice(index, index + size);
        await query(
            `
            INSERT INTO main.brigade_premium_shares (
                period, territory_uuid, branch_uuid, employee_uuid, active_from, active_until, indicator, premium
            )
            SELECT $1::date,
                   item.territory::uuid,
                   item.branch::uuid,
                   item.employee::uuid,
                   item.active_from::date,
                   item.active_until::date,
                   $2,
                   item.premium::numeric
            FROM unnest($3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
                AS item(territory, branch, employee, active_from, active_until, premium)
            `,
            [
                period,
                indicator,
                chunk.map((item) => item.territoryId),
                chunk.map((item) => item.branchId),
                chunk.map((item) => item.employeeId),
                chunk.map((item) => item.activeFrom),
                chunk.map((item) => item.activeUntil),
                chunk.map((item) => item.premium.toFixed(2)),
            ],
        );
    }
}

async function linkAccruals(
    query: PremiumQuery,
    period: string,
    indicator: string,
    branchId: string | null,
    listed: string[] | null,
): Promise<void> {
    await query(
        `
        UPDATE main.brigade_premium_shares share
        SET accrual_id = accrual.id
        FROM main.premium_accruals accrual
        WHERE share.period = $1::date
          AND share.indicator = $2
          AND share.accrual_id IS NULL
          AND ($3::uuid IS NULL OR share.branch_uuid = $3::uuid)
          AND ($4::uuid[] IS NULL OR share.branch_uuid = ANY($4::uuid[]))
          AND accrual.period = share.period
          AND accrual.employee_uuid = share.employee_uuid
          AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
          AND share.active_from <= accrual.active_until
          AND share.active_until >= accrual.active_from
        `,
        [period, indicator, branchId, listed],
    );
}

async function readSetups(
    query: PremiumQuery,
    period: string,
    branchId: string | null,
    listed: string[] | null,
): Promise<BrigadeSetupRow[]> {
    const rows = await query<{ branchId: string; mode: string; territoryId: string | null }>(
        `
        SELECT DISTINCT ON (setup.branch_uuid)
               setup.branch_uuid::text AS "branchId",
               setup.mode,
               branch.territory_uuid::text AS "territoryId"
        FROM main.branch_brigades setup
        JOIN branches branch ON branch.uuid = setup.branch_uuid
        WHERE setup.period <= $1::date
          AND ($2::uuid IS NULL OR setup.branch_uuid = $2::uuid)
          AND ($3::uuid[] IS NULL OR setup.branch_uuid = ANY($3::uuid[]))
        ORDER BY setup.branch_uuid, setup.period DESC
        `,
        [period, branchId, listed],
    );
    return rows.flatMap((row) => {
        if ((row.mode !== "off" && row.mode !== "all" && row.mode !== "groups") || !row.territoryId) {
            return [];
        }
        return [{ branchId: row.branchId.toLowerCase(), mode: row.mode, territoryId: row.territoryId }];
    });
}

async function readMembers(
    query: PremiumQuery,
    period: string,
    branchId: string | null,
    listed: string[] | null,
): Promise<BrigadeMemberRow[]> {
    const rows = await query<{ branchId: string; groupId: string; employeeId: string }>(
        `
        SELECT grp.branch_uuid::text AS "branchId",
               grp.id::text AS "groupId",
               member.employee_uuid::text AS "employeeId"
        FROM (
            SELECT DISTINCT ON (branch_uuid) branch_uuid, period
            FROM main.branch_brigades
            WHERE period <= $1::date
              AND ($2::uuid IS NULL OR branch_uuid = $2::uuid)
              AND ($3::uuid[] IS NULL OR branch_uuid = ANY($3::uuid[]))
            ORDER BY branch_uuid, period DESC
        ) effective
        JOIN main.branch_brigade_groups grp
            ON grp.branch_uuid = effective.branch_uuid
           AND grp.period = effective.period
        JOIN main.branch_brigade_members member ON member.group_id = grp.id
        ORDER BY grp.sort_order
        `,
        [period, branchId, listed],
    );
    return rows.map((row) => ({
        branchId: row.branchId.toLowerCase(),
        groupId: row.groupId,
        employeeId: row.employeeId.toLowerCase(),
    }));
}

async function readSettings(query: PremiumQuery): Promise<MotivationSettings> {
    const roles = await query<{ id: string; title: string }>(`
        SELECT id, title
        FROM motivation_roles
        ORDER BY sort_order, id
    `);
    const rules = await query<{ id: string; title: string; ktu: string; role_id: string | null }>(`
        SELECT id, title, ktu, role_id
        FROM motivation_role_rules
        ORDER BY sort_order, id
    `);
    return {
        roles: roles.map((role) => ({ id: role.id, title: role.title })),
        rules: rules.flatMap((rule) => {
            const ktu = ruleKtu(rule.ktu);
            if (!ktu) {
                return [];
            }
            return [{ id: rule.id, title: rule.title, ktu, roleId: rule.role_id }];
        }),
    };
}

function ruleKtu(value: string): RuleKtu | null {
    if (value === "plus" || value === "minus" || value === "any") {
        return value;
    }
    return null;
}

async function readOverrides(query: PremiumQuery, period: string): Promise<Map<string, Map<string, string | null>>> {
    const rows = await query<{ branch: string; employee: string; roleId: string | null }>(`
        SELECT branch, employee, role_id AS "roleId"
        FROM (
            SELECT DISTINCT ON (branch_uuid, employee_uuid)
                   branch_uuid::text AS branch,
                   employee_uuid::text AS employee,
                   role_id,
                   automatic
            FROM branch_motivation_roles
            WHERE period <= $1::date
            ORDER BY branch_uuid, employee_uuid, period DESC
        ) latest
        WHERE NOT automatic
    `, [period]);
    const overrides = new Map<string, Map<string, string | null>>();
    for (const row of rows) {
        const branchId = row.branch.toLowerCase();
        const branch = overrides.get(branchId) ?? new Map<string, string | null>();
        branch.set(row.employee.toLowerCase(), row.roleId);
        overrides.set(branchId, branch);
    }
    return overrides;
}

async function readVersions(query: PremiumQuery, period: string, asOf: string, branchId: string | null): Promise<VersionRow[]> {
    const rows = await query<VersionRow>(
        `
        SELECT staff.employees_uuid::text AS id,
               COALESCE(NULLIF(btrim(employee.name), ''), 'Сотрудник без имени') AS name,
               to_char(staff.date_modified, 'YYYY-MM-DD') AS "changedOn",
               staff.branch_uuid::text AS "branchId",
               COALESCE(staff.title, '') AS title,
               staff.ktu,
               staff.probation,
               staff.hourly_rate AS "hourlyRate",
               staff.salary_amount AS "salaryAmount",
               COALESCE(staff.status, '') AS status,
               staff.period = $1::date AS "inMonth"
        FROM raw.hr_ktu staff
        LEFT JOIN employees employee ON employee.uuid = staff.employees_uuid
        WHERE staff.date_modified >= ($1::date - INTERVAL '1 month')
          AND staff.date_modified < ($1::date + INTERVAL '1 month')
          AND staff.date_modified <= $2::date
          AND staff.employees_uuid IN (
              SELECT person.employees_uuid
              FROM raw.hr_ktu person
              WHERE person.period = $1::date
                AND ($3::uuid IS NULL OR person.branch_uuid = $3::uuid)
          )
        `,
        [period, asOf, branchId],
    );
    return rows.map((row) => ({ ...row, id: row.id.toLowerCase(), branchId: row.branchId.toLowerCase() }));
}

async function readTimesheet(
    query: PremiumQuery,
    period: string,
    branchId: string | null,
): Promise<{ id: string; branchId: string; day: string; schedule: number | null; timesheet: number | null }[]> {
    const rows = await query<{ id: string; branchId: string; day: string; schedule: number | string | null; timesheet: number | string | null }>(
        `
        SELECT day.employees_uuid::text AS id,
               day.branch_uuid::text AS "branchId",
               to_char(day.date, 'YYYY-MM-DD') AS day,
               day.norma_hour AS schedule,
               day.fact_hour AS timesheet
        FROM (
            SELECT sheet.employees_uuid,
                   sheet.branch_uuid,
                   sheet.date::date AS date,
                   MAX(sheet.norma_hour) AS norma_hour,
                   MAX(sheet.fact_hour) AS fact_hour
            FROM raw.grafiki_tabeli sheet
            WHERE sheet.period = $1::timestamp
              AND ($2::uuid IS NULL OR sheet.branch_uuid = $2::uuid)
            GROUP BY sheet.employees_uuid, sheet.branch_uuid, sheet.date::date
        ) day
        `,
        [period, branchId],
    );
    return rows.map((row) => ({
        id: row.id.toLowerCase(),
        branchId: row.branchId.toLowerCase(),
        day: row.day,
        schedule: amount(row.schedule),
        timesheet: amount(row.timesheet),
    }));
}

async function readPremiumDays(
    query: PremiumQuery,
    period: string,
    indicators: readonly string[],
    branchId: string | null,
    listed: string[] | null,
): Promise<{ branchId: string; id: string; day: string; indicator: string; amount: number }[]> {
    const rows = await query<{ branchId: string; id: string; day: string; indicator: string; amount: number | string }>(
        `
        SELECT day.branch_uuid::text AS "branchId",
               day.employee_uuid AS id,
               to_char(day.day, 'YYYY-MM-DD') AS day,
               indicator.name AS indicator,
               day.premium::float8 AS amount
        FROM main.basket_premium_days day
        JOIN baskets basket ON basket.id = day.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        WHERE day.period = $1::date
          AND indicator.name = ANY($2::text[])
          AND ($3::uuid IS NULL OR day.branch_uuid = $3::uuid)
          AND ($4::uuid[] IS NULL OR day.branch_uuid = ANY($4::uuid[]))
        `,
        [period, indicators, branchId, listed],
    );
    return rows.flatMap((row) => {
        const value = amount(row.amount);
        if (value === null) {
            return [];
        }
        return [{
            branchId: row.branchId.toLowerCase(),
            id: row.id.toLowerCase(),
            day: row.day,
            indicator: row.indicator,
            amount: value,
        }];
    });
}

async function readStoredShares(
    query: PremiumQuery,
    period: string,
    indicators: readonly string[],
    branchId: string | null,
    listed: string[] | null,
): Promise<(StoredShare & { indicator: string })[]> {
    const rows = await query<{ branchId: string; employeeId: string; activeFrom: string; indicator: string; premium: number | string }>(
        `
        SELECT share.branch_uuid::text AS "branchId",
               share.employee_uuid AS "employeeId",
               to_char(share.active_from, 'YYYY-MM-DD') AS "activeFrom",
               share.indicator,
               share.premium::float8 AS premium
        FROM main.brigade_premium_shares share
        WHERE share.period = $1::date
          AND share.indicator = ANY($2::text[])
          AND ($3::uuid IS NULL OR share.branch_uuid = $3::uuid)
          AND ($4::uuid[] IS NULL OR share.branch_uuid = ANY($4::uuid[]))
        `,
        [period, indicators, branchId, listed],
    );
    return rows.flatMap((row) => {
        const premium = amount(row.premium);
        if (premium === null) {
            return [];
        }
        return [{
            branchId: row.branchId.toLowerCase(),
            employeeId: row.employeeId.toLowerCase(),
            activeFrom: row.activeFrom,
            indicator: row.indicator,
            premium,
        }];
    });
}

async function readAccrualSpans(
    query: PremiumQuery,
    period: string,
    branchId: string | null,
    listed: string[] | null,
): Promise<Span[]> {
    const rows = await query<Span>(
        `
        SELECT COALESCE(accrual.branch_uuid::text, '') AS "branchId",
               accrual.employee_uuid AS "employeeId",
               to_char(accrual.active_from, 'YYYY-MM-DD') AS "from",
               to_char(accrual.active_until, 'YYYY-MM-DD') AS "until"
        FROM main.premium_accruals accrual
        WHERE accrual.period = $1::date
          AND ($2::uuid IS NULL OR accrual.branch_uuid IS NULL OR accrual.branch_uuid = $2::uuid)
          AND ($3::uuid[] IS NULL OR accrual.branch_uuid IS NULL OR accrual.branch_uuid = ANY($3::uuid[]))
        `,
        [period, branchId, listed],
    );
    return rows.map((row) => ({
        branchId: row.branchId.toLowerCase(),
        employeeId: row.employeeId.toLowerCase(),
        from: row.from,
        until: row.until,
    }));
}

async function readClosedSpans(query: PremiumQuery): Promise<Span[]> {
    const rows = await query<Span>(
        `
        SELECT branch_uuid::text AS "branchId",
               employee_uuid::text AS "employeeId",
               to_char(active_from, 'YYYY-MM-DD') AS "from",
               to_char(active_until, 'YYYY-MM-DD') AS "until"
        FROM closed_staff_segments
        `,
    );
    return rows.map((row) => ({
        branchId: row.branchId.toLowerCase(),
        employeeId: row.employeeId.toLowerCase(),
        from: row.from,
        until: row.until,
    }));
}

function amount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}
