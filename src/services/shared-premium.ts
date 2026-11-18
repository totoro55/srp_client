import type { QueryResultRow } from "pg";
import { splitByHours } from "@/lib/premium-split";
import { technicalAccount } from "@/lib/technical-accounts";
import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { automaticRole, type MotivationSettings, type RuleKtu } from "@/lib/motivation-roles";
import type { AccessView } from "@/server/authz/resolve-access";
import { getAppSettings } from "@/services/app-settings";
import { beginPremiumRecalc, failPremiumRecalc, finishPremiumRecalc, PremiumRecalcBusyError } from "@/services/basket-updates";
import { db } from "@/services/db";
import { MotivationSettingsError } from "@/services/motivation-roles";
import { branchVisible, SalePremiumError } from "@/services/sale-premium";
import type { StaffLockReason } from "@/lib/recalc-window";
import { lockStaffSegments, moscowToday, monthBefore, prepareClosedSegments } from "@/services/segment-locks";
import { premiumsBySegment, staffSegments, type HourDay, type StaffVersion } from "@/services/staff-segments";
import type { PremiumRun } from "@/services/sale-premium";

type PremiumQuery = <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;

const OPEN_SHARE_DELETE = `
    DELETE FROM main.shared_premiums share
    WHERE share.period = $1::date
      AND NOT EXISTS (
          SELECT 1
          FROM main.premium_accruals accrual
          WHERE accrual.period = share.period
            AND accrual.employee_uuid = share.employee_uuid
            AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
            AND share.active_from <= accrual.active_until
            AND share.active_until >= accrual.active_from
      )
      AND ($2::uuid IS NULL OR share.branch_uuid = $2::uuid)
      AND ($3::uuid[] IS NULL OR share.branch_uuid = ANY($3::uuid[]))
`;

const WINDOW_SHARE_DELETE = `
    DELETE FROM main.shared_premiums share
    WHERE share.period = $1::date
      AND ($2::uuid IS NULL OR share.branch_uuid = $2::uuid)
      AND ($5::uuid[] IS NULL OR share.branch_uuid = ANY($5::uuid[]))
      AND share.active_from <= $4::date
      AND share.active_until >= $3::date
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
`;

const ACCRUAL_LINK = `
    UPDATE main.shared_premiums share
    SET accrual_id = accrual.id
    FROM main.premium_accruals accrual
    WHERE share.period = $1::date
      AND share.accrual_id IS NULL
      AND accrual.period = share.period
      AND accrual.employee_uuid = share.employee_uuid
      AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
      AND share.active_from <= accrual.active_until
      AND share.active_until >= accrual.active_from
`;

interface ShareInsert {
    territory: string;
    branch: string;
    employee: string;
    from: string;
    until: string;
    premium: number;
}

interface AuthorInsert {
    branch: string;
    employee: string;
    kind: "staff" | "promoter" | "system";
    from: string;
    sale: number;
    release: number;
    kassa: number;
    osnt: number;
    warehouse: number;
    unloading: number;
    selection: number;
}

interface OutsideAuthor {
    branchId: string;
    employeeId: string;
    kind: "promoter" | "system";
    sale: number;
    release: number;
    kassa: number;
    osnt: number;
    warehouse: number;
    unloading: number;
    selection: number;
}

export async function writeSharedPremiums(
    query: PremiumQuery,
    period: string,
    branchId?: string,
    run?: PremiumRun,
): Promise<number> {
    const onlyBranch = branchId?.toLowerCase() ?? null;
    const listed = onlyBranch || !run?.branches ? null : run.branches.map((id) => id.toLowerCase());
    const listedSet = listed ? new Set(listed) : null;
    const asOf = run?.asOf ?? moscowToday();
    const earliest = run?.earliest ?? monthBefore(asOf);
    const window = run?.from && run?.until ? { from: run.from, until: run.until } : null;
    const prepared = await prepareSharedPremium(query, period, onlyBranch, asOf, window, run?.protect, earliest, listed);
    const inserts = listedSet ? prepared.inserts.filter((item) => listedSet.has(item.branch)) : prepared.inserts;
    const authors = listedSet ? prepared.authors.filter((item) => listedSet.has(item.branch)) : prepared.authors;
    await query(
        window ? WINDOW_SHARE_DELETE : OPEN_SHARE_DELETE,
        window ? [period, onlyBranch, window.from, window.until, listed] : [period, onlyBranch, listed],
    );
    await insertShares(query, period, inserts);
    await query(ACCRUAL_LINK, [period]);
    await replaceAuthors(query, period, authors, onlyBranch, listed);
    await lockStaffSegments(query, asOf, earliest, window ? run?.protect : undefined);
    return inserts.length;
}

/** Смена ролей делит уже записанный вклад филиала. Документы корзин и закрытие отрезков не перечитываются. */
async function redistributeBranchSharedPremium(query: PremiumQuery, period: string, branchId: string): Promise<number> {
    const onlyBranch = branchId.toLowerCase();
    const stored = await readStoredBranchPool(query, period, onlyBranch);
    if (!stored.calculated) {
        await query("SET LOCAL work_mem = '512MB'");
        return writeSharedPremiums(query, period, onlyBranch);
    }
    const asOf = moscowToday();
    const settings = await readSettings(query);
    const overrides = await readOverrides(query, period);
    const territories = await readTerritories(query);
    const versions = await readVersions(query, period, asOf, onlyBranch);
    const days = await readTimesheet(query, period, asOf, onlyBranch);
    const roleSets = await readRoleSets(query);
    const frozen = await readFrozenShares(query, period, onlyBranch);
    const pools = new Map<string, number>([[onlyBranch, stored.pool]]);
    const { inserts } = sharesToWrite(
        period,
        settings,
        overrides,
        territories,
        versions,
        days,
        [],
        frozen,
        { pools, authors: [] },
        roleSets,
        onlyBranch,
    );
    await query(OPEN_SHARE_DELETE, [period, onlyBranch, null]);
    await insertShares(query, period, inserts);
    await query(
        `
        UPDATE main.shared_premiums share
        SET accrual_id = accrual.id
        FROM main.premium_accruals accrual
        WHERE share.period = $1::date
          AND share.branch_uuid = $2::uuid
          AND share.accrual_id IS NULL
          AND accrual.period = share.period
          AND accrual.employee_uuid = share.employee_uuid
          AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
          AND share.active_from <= accrual.active_until
          AND share.active_until >= accrual.active_from
        `,
        [period, onlyBranch],
    );
    return inserts.length;
}

async function readStoredBranchPool(
    query: PremiumQuery,
    period: string,
    branchId: string,
): Promise<{ pool: number; calculated: boolean }> {
    const rows = await query<{ pool: number | string; authors: number; shares: number }>(
        `
        SELECT COALESCE((
                   SELECT SUM(
                       author.sale + author.release + author.kassa
                       + author.osnt + author.warehouse + author.unloading + author.selection
                   )
                   FROM main.shared_premium_authors author
                   WHERE author.period = $1::date
                     AND author.branch_uuid = $2::uuid
               ), 0)::float8 AS pool,
               (
                   SELECT count(*)::int
                   FROM main.shared_premium_authors author
                   WHERE author.period = $1::date
                     AND author.branch_uuid = $2::uuid
               ) AS authors,
               (
                   SELECT count(*)::int
                   FROM main.shared_premiums share
                   WHERE share.period = $1::date
                     AND share.branch_uuid = $2::uuid
               ) AS shares
        `,
        [period, branchId],
    );
    const row = rows[0];
    return {
        pool: amount(row?.pool) ?? 0,
        calculated: (row?.authors ?? 0) > 0 || (row?.shares ?? 0) > 0,
    };
}

export async function refreshSharedPremiumAuthors(period: string): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query("SET LOCAL statement_timeout = 0");
        const { authors } = await prepareSharedPremium(query, period, null, moscowToday());
        await replaceAuthors(query, period, authors, null);
        return authors.length;
    });
}

async function prepareSharedPremium(
    query: PremiumQuery,
    period: string,
    onlyBranch: string | null,
    asOf: string,
    window: { from: string; until: string } | null = null,
    protect?: readonly StaffLockReason[] | null,
    earliest?: string,
    listed: string[] | null = null,
): Promise<{ inserts: ShareInsert[]; authors: AuthorInsert[] }> {
    const settings = await readSettings(query);
    const overrides = await readOverrides(query, period);
    const territories = await readTerritories(query);
    const versions = await readVersions(query, period, asOf, onlyBranch, listed);
    const days = await readTimesheet(query, period, asOf, onlyBranch, listed);
    const premiumDays = await readPremiumDays(query, period, asOf, onlyBranch, listed);
    const outside = await readOutsideContributions(query, period, onlyBranch, asOf, listed);
    const roleSets = await readRoleSets(query);
    if (!window) {
        const frozen = await readFrozenShares(query, period, onlyBranch, listed);
        return sharesToWrite(period, settings, overrides, territories, versions, days, premiumDays, frozen, outside, roleSets, onlyBranch);
    }
    await prepareClosedSegments(query, asOf, earliest ?? monthBefore(asOf), protect);
    const frozen = await readRetainedShares(query, period, window.from, window.until, onlyBranch, listed);
    const locked = await readClosedSpans(query);
    return sharesToWrite(period, settings, overrides, territories, versions, days, premiumDays, frozen, outside, roleSets, onlyBranch, window, locked);
}

const PERIOD = /^\d{4}-\d{2}-01$/;

export async function calculateSharedPremium(period: string, run?: PremiumRun): Promise<number> {
    if (!PERIOD.test(period)) {
        throw new SalePremiumError("Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!run?.allowClosed && !monthIsOpen(period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const asOf = run?.asOf ?? moscowToday();
    return db.transaction(async (query) => {
        await query("SET LOCAL work_mem = '512MB'");
        await query(run?.timeoutMs ? `SET LOCAL statement_timeout = ${Math.trunc(run.timeoutMs)}` : "SET LOCAL statement_timeout = 0");
        return writeSharedPremiums(query, period, run?.branch, { ...run, asOf });
    });
}

export async function readBranchSharedPremiums(period: string, branchId: string): Promise<Record<string, number>> {
    const rows = await db.query<{ id: string; activeFrom: string; premium: number | string }>(
        `
        SELECT share.employee_uuid AS id,
               to_char(share.active_from, 'YYYY-MM-DD') AS "activeFrom",
               share.premium::float8 AS premium
        FROM main.shared_premiums share
        WHERE share.period = $1::date
          AND share.branch_uuid = $2::uuid
        `,
        [period, branchId],
    );
    const shares: Record<string, number> = {};
    for (const row of rows) {
        const premium = amount(row.premium);
        if (premium === null) {
            continue;
        }
        shares[`${row.id}:${row.activeFrom}`] = premium;
    }
    return shares;
}

export interface SharedPremiumAuthorRow {
    id: string;
    name: string;
    title: string;
    kind: "staff" | "promoter" | "system";
    sale: number;
    release: number;
    kassa: number;
    osnt: number;
    warehouse: number;
    unloading: number;
    selection: number;
    activeFrom: string;
}

function authorKind(value: string): SharedPremiumAuthorRow["kind"] | null {
    if (value === "staff" || value === "promoter" || value === "system") {
        return value;
    }
    return null;
}

export async function readSharedPremiumAuthors(
    access: AccessView,
    period: string,
    branchId: string,
): Promise<SharedPremiumAuthorRow[] | null> {
    if (!PERIOD.test(period) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchId)) {
        return null;
    }
    if (!await branchVisible(access, period, branchId)) {
        return null;
    }
    const rows = await db.query<{
        id: string;
        kind: string;
        activeFrom: string;
        sale: number | string;
        release: number | string;
        kassa: number | string;
        osnt: number | string;
        warehouse: number | string;
        unloading: number | string;
        selection: number | string;
        name: string;
        title: string;
    }>(
        `
        SELECT author.employee_uuid AS id,
               author.author_kind AS kind,
               to_char(author.active_from, 'YYYY-MM-DD') AS "activeFrom",
               author.sale::float8 AS sale,
               author.release::float8 AS release,
               author.kassa::float8 AS kassa,
               author.osnt::float8 AS osnt,
               author.warehouse::float8 AS warehouse,
               author.unloading::float8 AS unloading,
               author.selection::float8 AS selection,
               COALESCE(
                   NULLIF(btrim(person.name), ''),
                   NULLIF(btrim(promoter.name_employees), ''),
                   'Сотрудник без имени'
               ) AS name,
               CASE
                   WHEN author.author_kind = 'system' THEN 'Система'
                   WHEN author.author_kind = 'promoter' THEN COALESCE(NULLIF(btrim(promoter.title), ''), 'Промоутер')
                   ELSE COALESCE(NULLIF(btrim(staff.title), ''), 'Должность не указана')
               END AS title
        FROM main.shared_premium_authors author
        LEFT JOIN employees person ON person.uuid = author.employee_uuid
        LEFT JOIN LATERAL (
            SELECT promoter_row.name_employees, promoter_row.title
            FROM raw.hr_ktu_promouter promoter_row
            WHERE author.author_kind = 'promoter'
              AND promoter_row.employees_uuid = author.employee_uuid
              AND promoter_row.branch_uuid = author.branch_uuid
            ORDER BY promoter_row.date_modified DESC
            LIMIT 1
        ) promoter ON TRUE
        LEFT JOIN LATERAL (
            SELECT hr.title
            FROM raw.hr_ktu hr
            WHERE author.author_kind = 'staff'
              AND hr.employees_uuid = author.employee_uuid
              AND hr.date_modified <= author.active_from
            ORDER BY hr.date_modified DESC
            LIMIT 1
        ) staff ON TRUE
        WHERE author.period = $1::date
          AND author.branch_uuid = $2::uuid
        `,
        [period, branchId],
    );
    return rows.flatMap((row) => {
        const sale = amount(row.sale);
        const release = amount(row.release);
        const kassa = amount(row.kassa);
        const osnt = amount(row.osnt);
        const warehouse = amount(row.warehouse);
        const unloading = amount(row.unloading);
        const selection = amount(row.selection);
        if (sale === null || release === null || kassa === null || osnt === null || warehouse === null || unloading === null || selection === null) {
            return [];
        }
        const kind = authorKind(row.kind);
        if (!kind) {
            return [];
        }
        const account = kind === "system" ? technicalAccount(row.id) : null;
        return [{
            id: row.id,
            name: account?.name ?? row.name,
            title: row.title,
            kind,
            sale,
            release,
            kassa,
            osnt,
            warehouse,
            unloading,
            selection,
            activeFrom: row.activeFrom,
        }];
    }).sort((left, right) => (
        (right.sale + right.release + right.kassa + right.osnt + right.warehouse + right.unloading + right.selection)
        - (left.sale + left.release + left.kassa + left.osnt + left.warehouse + left.unloading + left.selection)
    ) || left.name.localeCompare(right.name, "ru"));
}

export async function readBranchSharedPremiumRoleIds(branchId: string): Promise<string[]> {
    const rows = await db.query<{ roleId: string }>(
        `
        SELECT role_id AS "roleId"
        FROM branch_shared_premium_roles
        WHERE branch_uuid = $1::uuid
        ORDER BY role_id
        `,
        [branchId],
    );
    return rows.map((row) => row.roleId);
}

export async function saveBranchSharedPremiumRoles(
    branchId: string,
    period: string,
    roleIds: string[],
    actor: string,
): Promise<{ recalculated: boolean; shares: Record<string, number>; recalcMessage: string | null }> {
    const unique = [...new Set(roleIds.map((roleId) => roleId.trim().toLowerCase()))];
    if (unique.some((roleId) => !/^[a-z][a-z0-9-]{0,39}$/.test(roleId))) {
        throw new MotivationSettingsError("Выберите роль из списка");
    }
    if (unique.length > 0) {
        const found = await db.query<{ id: string }>(
            `SELECT id FROM motivation_roles WHERE id = ANY($1::text[])`,
            [unique],
        );
        if (found.length !== unique.length) {
            throw new MotivationSettingsError("Выберите роль из списка");
        }
    }
    const settings = await getAppSettings();
    const open = monthIsOpen(period.slice(0, 7), buildRrsEditPolicy(settings.rrsEditCutoffDay));
    await db.transaction(async (query) => {
        await replaceSharedPremiumRoles(query, branchId, unique);
    });
    if (!open) {
        return { recalculated: false, shares: {}, recalcMessage: null };
    }
    let runId: number;
    try {
        runId = await beginPremiumRecalc({
            kind: "shared",
            period,
            origin: "manual",
            trigger: "branch.shared-roles",
            actor,
            scopeLevel: "branch",
            scopeIds: [branchId],
        });
    } catch (error) {
        if (error instanceof PremiumRecalcBusyError) {
            return { recalculated: false, shares: {}, recalcMessage: error.message };
        }
        throw error;
    }
    try {
        const lines = await db.transaction(async (query) => {
            await query("SET LOCAL statement_timeout = 0");
            return redistributeBranchSharedPremium(query, period, branchId);
        });
        await finishPremiumRecalc(runId, lines);
        return {
            recalculated: true,
            shares: await readBranchSharedPremiums(period, branchId),
            recalcMessage: null,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Не удалось пересчитать общую премию";
        await failPremiumRecalc(runId, error, "/api/branch/shared-premium-roles");
        return { recalculated: false, shares: {}, recalcMessage: message };
    }
}

async function replaceSharedPremiumRoles(query: PremiumQuery, branchId: string, roleIds: string[]): Promise<void> {
    const branch = branchId.toLowerCase();
    await query(
        `DELETE FROM branch_shared_premium_roles WHERE branch_uuid = $1::uuid`,
        [branch],
    );
    if (roleIds.length === 0) {
        return;
    }
    await query(
        `
        INSERT INTO branch_shared_premium_roles (branch_uuid, role_id)
        SELECT $1::uuid, role_id
        FROM unnest($2::text[]) AS role_id
        `,
        [branch, roleIds],
    );
}

async function readRoleSets(query: PremiumQuery): Promise<Map<string, Set<string>>> {
    const rows = await query<{ branch: string; roleId: string }>(`
        SELECT branch_uuid AS branch,
               role_id AS "roleId"
        FROM branch_shared_premium_roles
    `);
    const sets = new Map<string, Set<string>>();
    for (const row of rows) {
        const roles = sets.get(row.branch) ?? new Set<string>();
        roles.add(row.roleId);
        sets.set(row.branch, roles);
    }
    return sets;
}

function sharesToWrite(
    period: string,
    settings: MotivationSettings,
    overrides: Map<string, Map<string, string | null>>,
    territories: Map<string, string>,
    versions: VersionRow[],
    days: TimesheetRow[],
    premiumDays: PremiumDayRow[],
    frozen: FrozenShare[],
    outside: { pools: Map<string, number>; authors: OutsideAuthor[] },
    roleSets: Map<string, Set<string>>,
    onlyBranch: string | null,
    window: { from: string; until: string } | null = null,
    locked: LockedSpan[] = [],
): { inserts: ShareInsert[]; authors: AuthorInsert[] } {
    const versionsByEmployee = new Map<string, StaffVersion[]>();
    const employeesByBranch = new Map<string, Set<string>>();
    for (const row of versions) {
        const list = versionsByEmployee.get(row.id) ?? [];
        list.push(row);
        versionsByEmployee.set(row.id, list);
        if (!row.inMonth) {
            continue;
        }
        const atBranch = employeesByBranch.get(row.branchId) ?? new Set<string>();
        atBranch.add(row.id);
        employeesByBranch.set(row.branchId, atBranch);
    }
    const daysByBranch = groupBy(days, (day) => day.branchId);
    const saleByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    const releaseByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    const kassaByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    const osntByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    const warehouseByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    const unloadingByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    const selectionByBranch = new Map<string, { id: string; day: string; amount: number }[]>();
    for (const day of premiumDays) {
        const target = day.indicator === "Выдача товара"
            ? releaseByBranch
            : day.indicator === "Кассовые операции"
                ? kassaByBranch
                : day.indicator === "ОСНТ"
                    ? osntByBranch
                    : day.indicator === "Складские операции"
                        ? warehouseByBranch
                        : day.indicator === "Разгрузка ТС"
                            ? unloadingByBranch
                            : day.indicator === "Набор товара"
                                ? selectionByBranch
                                : saleByBranch;
        const list = target.get(day.branchId) ?? [];
        list.push({ id: day.id, day: day.day, amount: day.amount });
        target.set(day.branchId, list);
    }
    const frozenByBranch = new Map<string, Map<string, number>>();
    for (const share of frozen) {
        const branchShares = frozenByBranch.get(share.branchId) ?? new Map<string, number>();
        branchShares.set(`${share.employeeId}:${share.activeFrom}`, share.premium);
        frozenByBranch.set(share.branchId, branchShares);
    }
    const inserts: ShareInsert[] = [];
    const authors: AuthorInsert[] = [];
    for (const outsideAuthor of outside.authors) {
        if (onlyBranch && outsideAuthor.branchId !== onlyBranch) {
            continue;
        }
        if (
            outsideAuthor.sale === 0
            && outsideAuthor.release === 0
            && outsideAuthor.kassa === 0
            && outsideAuthor.osnt === 0
            && outsideAuthor.warehouse === 0
            && outsideAuthor.unloading === 0
            && outsideAuthor.selection === 0
        ) {
            continue;
        }
        authors.push({
            branch: outsideAuthor.branchId,
            employee: outsideAuthor.employeeId,
            kind: outsideAuthor.kind,
            from: period,
            sale: outsideAuthor.sale,
            release: outsideAuthor.release,
            kassa: outsideAuthor.kassa,
            osnt: outsideAuthor.osnt,
            warehouse: outsideAuthor.warehouse,
            unloading: outsideAuthor.unloading,
            selection: outsideAuthor.selection,
        });
    }
    for (const [branchId, employeeIds] of employeesByBranch) {
        if (onlyBranch && branchId.toLowerCase() !== onlyBranch) {
            continue;
        }
        const territory = territories.get(branchId);
        if (!territory) {
            continue;
        }
        const allowedRoles = roleSets.get(branchId);
        const branchVersions: StaffVersion[] = [];
        for (const employeeId of employeeIds) {
            const list = versionsByEmployee.get(employeeId);
            if (list) {
                branchVersions.push(...list);
            }
        }
        const segments = staffSegments(
            branchVersions,
            (daysByBranch.get(branchId) ?? []).map((day) => ({ id: day.id, day: day.day, schedule: day.schedule, timesheet: day.timesheet })),
            branchId,
            period,
        );
        const sale = premiumsBySegment(segments, saleByBranch.get(branchId) ?? []);
        const release = premiumsBySegment(segments, releaseByBranch.get(branchId) ?? []);
        const kassa = premiumsBySegment(segments, kassaByBranch.get(branchId) ?? []);
        const osnt = premiumsBySegment(segments, osntByBranch.get(branchId) ?? []);
        const warehouse = premiumsBySegment(segments, warehouseByBranch.get(branchId) ?? []);
        const unloading = premiumsBySegment(segments, unloadingByBranch.get(branchId) ?? []);
        const selection = premiumsBySegment(segments, selectionByBranch.get(branchId) ?? []);
        let pool = outside.pools.get(branchId) ?? outside.pools.get(branchId.toLowerCase()) ?? 0;
        for (const segment of segments) {
            if (participates(segment.ktu, roleOf(branchId, segment.id, segment.title, segment.ktu, overrides, settings))) {
                continue;
            }
            const saleAmount = sale[segment.rowKey] ?? 0;
            const releaseAmount = release[segment.rowKey] ?? 0;
            const kassaAmount = kassa[segment.rowKey] ?? 0;
            const osntAmount = osnt[segment.rowKey] ?? 0;
            const warehouseAmount = warehouse[segment.rowKey] ?? 0;
            const unloadingAmount = unloading[segment.rowKey] ?? 0;
            const selectionAmount = selection[segment.rowKey] ?? 0;
            pool += saleAmount + releaseAmount + kassaAmount + osntAmount + warehouseAmount + unloadingAmount + selectionAmount;
            if (
                saleAmount !== 0
                || releaseAmount !== 0
                || kassaAmount !== 0
                || osntAmount !== 0
                || warehouseAmount !== 0
                || unloadingAmount !== 0
                || selectionAmount !== 0
            ) {
                authors.push({
                    branch: branchId,
                    employee: segment.id,
                    kind: "staff",
                    from: segment.activeFrom,
                    sale: saleAmount,
                    release: releaseAmount,
                    kassa: kassaAmount,
                    osnt: osntAmount,
                    warehouse: warehouseAmount,
                    unloading: unloadingAmount,
                    selection: selectionAmount,
                });
            }
        }
        const closed = frozenByBranch.get(branchId) ?? new Map<string, number>();
        const frozenKopecks = [...closed.values()].reduce((sum, premium) => sum + Math.round(premium * 100), 0);
        const recipients = segments.flatMap((segment) => {
            const roleId = roleOf(branchId, segment.id, segment.title, segment.ktu, overrides, settings);
            if (!receivesShare(segment.ktu, roleId, allowedRoles)) {
                return [];
            }
            if (closed.has(segment.rowKey)) {
                return [];
            }
            if (window && (segment.activeFrom > window.until || segment.activeUntil < window.from)) {
                return [];
            }
            if (locked.some((span) => span.branchId === branchId.toLowerCase()
                && span.employeeId === segment.id.toLowerCase()
                && span.from <= segment.activeUntil
                && span.until >= segment.activeFrom)) {
                return [];
            }
            const hours = segment.timesheetHours ?? 0;
            return [{
                key: segment.rowKey,
                hours: hours > 0 ? hours : 0,
                id: segment.id,
                from: segment.activeFrom,
                until: segment.activeUntil,
            }];
        });
        const remaining = Math.max(0, Math.round(pool * 100) - frozenKopecks) / 100;
        const shares = splitByHours(remaining, recipients);
        for (const recipient of recipients) {
            inserts.push({
                territory,
                branch: branchId,
                employee: recipient.id,
                from: recipient.from,
                until: recipient.until,
                premium: shares[recipient.key] ?? 0,
            });
        }
    }
    return { inserts, authors };
}

function participates(ktu: boolean | null, roleId: string | null): boolean {
    return ktu === true || roleId !== null;
}

function receivesShare(ktu: boolean | null, roleId: string | null, allowedRoles: Set<string> | undefined): boolean {
    if (!participates(ktu, roleId)) {
        return false;
    }
    if (!allowedRoles) {
        return true;
    }
    return roleId !== null && allowedRoles.has(roleId);
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

async function insertShares(query: PremiumQuery, period: string, inserts: ShareInsert[]): Promise<void> {
    const size = 500;
    for (let index = 0; index < inserts.length; index += size) {
        const chunk = inserts.slice(index, index + size);
        await query(
            `
            INSERT INTO main.shared_premiums (
                period, territory_uuid, branch_uuid, employee_uuid, active_from, active_until, premium
            )
            SELECT $1::date,
                   item.territory::uuid,
                   item.branch::uuid,
                   item.employee::uuid,
                   item.active_from::date,
                   item.active_until::date,
                   item.premium::numeric
            FROM unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])
                AS item(territory, branch, employee, active_from, active_until, premium)
            `,
            [
                period,
                chunk.map((item) => item.territory),
                chunk.map((item) => item.branch),
                chunk.map((item) => item.employee),
                chunk.map((item) => item.from),
                chunk.map((item) => item.until),
                chunk.map((item) => item.premium.toFixed(2)),
            ],
        );
    }
}

async function replaceAuthors(
    query: PremiumQuery,
    period: string,
    authors: AuthorInsert[],
    onlyBranch: string | null,
    listed: string[] | null = null,
): Promise<void> {
    await query(
        `
        DELETE FROM main.shared_premium_authors author
        WHERE author.period = $1::date
          AND ($2::uuid IS NULL OR author.branch_uuid = $2::uuid)
          AND ($3::uuid[] IS NULL OR author.branch_uuid = ANY($3::uuid[]))
        `,
        [period, onlyBranch, listed],
    );
    const size = 500;
    for (let index = 0; index < authors.length; index += size) {
        const chunk = authors.slice(index, index + size);
        await query(
            `
            INSERT INTO main.shared_premium_authors (
                period, branch_uuid, employee_uuid, author_kind, active_from,
                sale, release, kassa, osnt, warehouse, unloading, selection
            )
            SELECT $1::date,
                   item.branch::uuid,
                   item.employee::uuid,
                   item.kind,
                   item.active_from::date,
                   item.sale::numeric,
                   item.release::numeric,
                   item.kassa::numeric,
                   item.osnt::numeric,
                   item.warehouse::numeric,
                   item.unloading::numeric,
                   item.selection::numeric
            FROM unnest(
                $2::text[], $3::text[], $4::text[], $5::text[],
                $6::text[], $7::text[], $8::text[], $9::text[], $10::text[], $11::text[], $12::text[]
            ) AS item(branch, employee, kind, active_from, sale, release, kassa, osnt, warehouse, unloading, selection)
            `,
            [
                period,
                chunk.map((item) => item.branch),
                chunk.map((item) => item.employee),
                chunk.map((item) => item.kind),
                chunk.map((item) => item.from),
                chunk.map((item) => item.sale.toFixed(2)),
                chunk.map((item) => item.release.toFixed(2)),
                chunk.map((item) => item.kassa.toFixed(2)),
                chunk.map((item) => item.osnt.toFixed(2)),
                chunk.map((item) => item.warehouse.toFixed(2)),
                chunk.map((item) => item.unloading.toFixed(2)),
                chunk.map((item) => item.selection.toFixed(2)),
            ],
        );
    }
}

async function readOutsideContributions(
    query: PremiumQuery,
    period: string,
    branchId: string | null,
    asOf: string,
    listed: string[] | null,
): Promise<{ pools: Map<string, number>; authors: OutsideAuthor[] }> {
    const rows = await query<{ branch: string; employee: string; kind: string; indicator: string; premium: number | string }>(
        `
        SELECT day.branch_uuid AS branch,
               day.employee_uuid AS employee,
               day.author_kind AS kind,
               indicator.name AS indicator,
               COALESCE(SUM(day.premium), 0)::float8 AS premium
        FROM main.basket_premium_days day
        JOIN baskets basket ON basket.id = day.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        WHERE day.period = $1::date
          AND day.day <= $2::date
          AND day.author_kind IN ('promoter', 'system')
          AND ($3::uuid IS NULL OR day.branch_uuid = $3::uuid)
          AND ($4::uuid[] IS NULL OR day.branch_uuid = ANY($4::uuid[]))
          AND indicator.name IN (
              'Продажа товара', 'Выдача товара', 'Кассовые операции',
              'ОСНТ', 'Складские операции', 'Разгрузка ТС', 'Набор товара'
          )
        GROUP BY day.branch_uuid, day.employee_uuid, day.author_kind, indicator.name
        `,
        [period, asOf, branchId, listed],
    );
    const byAuthor = new Map<string, OutsideAuthor>();
    for (const row of rows) {
        const premium = amount(row.premium);
        const field = outsideField(row.indicator);
        if (!row.branch || !row.employee || premium === null || premium === 0 || field === null || (row.kind !== "promoter" && row.kind !== "system")) {
            continue;
        }
        const key = `${row.branch}:${row.employee}:${row.kind}`;
        const current = byAuthor.get(key) ?? emptyOutside(row.branch, row.employee, row.kind);
        current[field] += premium;
        byAuthor.set(key, current);
    }
    const authors = [...byAuthor.values()];
    const pools = new Map<string, number>();
    for (const author of authors) {
        pools.set(
            author.branchId,
            (pools.get(author.branchId) ?? 0)
                + author.sale
                + author.release
                + author.kassa
                + author.osnt
                + author.warehouse
                + author.unloading
                + author.selection,
        );
    }
    return { pools, authors };
}

function outsideField(indicator: string): "sale" | "release" | "kassa" | "osnt" | "warehouse" | "unloading" | "selection" | null {
    if (indicator === "Продажа товара") {
        return "sale";
    }
    if (indicator === "Выдача товара") {
        return "release";
    }
    if (indicator === "Кассовые операции") {
        return "kassa";
    }
    if (indicator === "ОСНТ") {
        return "osnt";
    }
    if (indicator === "Складские операции") {
        return "warehouse";
    }
    if (indicator === "Разгрузка ТС") {
        return "unloading";
    }
    if (indicator === "Набор товара") {
        return "selection";
    }
    return null;
}

function emptyOutside(branchId: string, employeeId: string, kind: "promoter" | "system"): OutsideAuthor {
    return {
        branchId,
        employeeId,
        kind,
        sale: 0,
        release: 0,
        kassa: 0,
        osnt: 0,
        warehouse: 0,
        unloading: 0,
        selection: 0,
    };
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
        -- Ближайшая ручная роль не позже месяца расчёта. automatic снова отдаёт роль правилу.
        SELECT branch, employee, role_id AS "roleId"
        FROM (
            SELECT DISTINCT ON (branch_uuid, employee_uuid)
                   branch_uuid AS branch,
                   employee_uuid AS employee,
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
        const branch = overrides.get(row.branch) ?? new Map<string, string | null>();
        branch.set(row.employee, row.roleId);
        overrides.set(row.branch, branch);
    }
    return overrides;
}

async function readTerritories(query: PremiumQuery): Promise<Map<string, string>> {
    const rows = await query<{ id: string; territory: string }>(`
        SELECT branch.uuid AS id,
               branch.territory_uuid AS territory
        FROM branches branch
        WHERE NOT branch.deleted
          AND branch.territory_uuid IS NOT NULL
    `);
    return new Map(rows.map((row) => [row.id, row.territory]));
}

interface VersionRow extends StaffVersion {
    inMonth: boolean;
}

async function readVersions(query: PremiumQuery, period: string, asOf: string, branchId: string | null = null, listed: string[] | null = null): Promise<VersionRow[]> {
    return query<VersionRow>(
        `
        SELECT staff.employees_uuid AS id,
               COALESCE(NULLIF(btrim(employee.name), ''), 'Сотрудник без имени') AS name,
               to_char(staff.date_modified, 'YYYY-MM-DD') AS "changedOn",
               staff.branch_uuid AS "branchId",
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
                AND ($4::uuid[] IS NULL OR person.branch_uuid = ANY($4::uuid[]))
          )
        `,
        [period, asOf, branchId, listed],
    );
}

interface TimesheetRow extends HourDay {
    branchId: string;
}

async function readTimesheet(query: PremiumQuery, period: string, asOf: string, branchId: string | null = null, listed: string[] | null = null): Promise<TimesheetRow[]> {
    const rows = await query<{ id: string; branchId: string; day: string; schedule: number | string | null; timesheet: number | string | null }>(
        `
        SELECT day.employees_uuid AS id,
               day.branch_uuid AS "branchId",
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
              AND sheet.date::date <= $2::date
              AND ($3::uuid IS NULL OR sheet.branch_uuid = $3::uuid)
              AND ($4::uuid[] IS NULL OR sheet.branch_uuid = ANY($4::uuid[]))
            GROUP BY sheet.employees_uuid, sheet.branch_uuid, sheet.date::date
        ) day
        `,
        [period, asOf, branchId, listed],
    );
    return rows.map((row) => ({
        id: row.id,
        branchId: row.branchId,
        day: row.day,
        schedule: amount(row.schedule),
        timesheet: amount(row.timesheet),
    }));
}

interface PremiumDayRow {
    branchId: string;
    id: string;
    day: string;
    indicator: string;
    amount: number;
}

async function readPremiumDays(query: PremiumQuery, period: string, asOf: string, branchId: string | null = null, listed: string[] | null = null): Promise<PremiumDayRow[]> {
    const rows = await dbRows(query, period, asOf, branchId, listed);
    return rows;
}

async function dbRows(query: PremiumQuery, period: string, asOf: string, branchId: string | null, listed: string[] | null): Promise<PremiumDayRow[]> {
    const rows = await query<{ branchId: string; id: string; day: string; indicator: string; amount: number | string }>(
        `
        SELECT day.branch_uuid AS "branchId",
               day.employee_uuid AS id,
               to_char(day.day, 'YYYY-MM-DD') AS day,
               indicator.name AS indicator,
               day.premium::float8 AS amount
        FROM main.basket_premium_days day
        JOIN baskets basket ON basket.id = day.basket_id
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        WHERE day.period = $1::date
          AND day.day <= $2::date
          AND day.author_kind = 'staff'
          AND ($3::uuid IS NULL OR day.branch_uuid = $3::uuid)
          AND ($4::uuid[] IS NULL OR day.branch_uuid = ANY($4::uuid[]))
          AND indicator.name IN (
              'Продажа товара', 'Выдача товара', 'Кассовые операции',
              'ОСНТ', 'Складские операции', 'Разгрузка ТС', 'Набор товара'
          )
        `,
        [period, asOf, branchId, listed],
    );
    return rows.flatMap((row) => {
        const value = amount(row.amount);
        if (value === null) {
            return [];
        }
        return [{ branchId: row.branchId, id: row.id, day: row.day, indicator: row.indicator, amount: value }];
    });
}

interface FrozenShare {
    branchId: string;
    employeeId: string;
    activeFrom: string;
    premium: number;
}

interface LockedSpan {
    employeeId: string;
    branchId: string;
    from: string;
    until: string;
}

async function readFrozenShares(query: PremiumQuery, period: string, branchId: string | null = null, listed: string[] | null = null): Promise<FrozenShare[]> {
    const rows = await query<{ branchId: string; employeeId: string; activeFrom: string; premium: number | string }>(
        `
        SELECT share.branch_uuid AS "branchId",
               share.employee_uuid AS "employeeId",
               to_char(share.active_from, 'YYYY-MM-DD') AS "activeFrom",
               share.premium::float8 AS premium
        FROM main.shared_premiums share
        WHERE share.period = $1::date
          AND ($2::uuid IS NULL OR share.branch_uuid = $2::uuid)
          AND ($3::uuid[] IS NULL OR share.branch_uuid = ANY($3::uuid[]))
          AND EXISTS (
              SELECT 1
              FROM main.premium_accruals accrual
              WHERE accrual.period = share.period
                AND accrual.employee_uuid = share.employee_uuid
                AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
                AND share.active_from <= accrual.active_until
                AND share.active_until >= accrual.active_from
          )
        `,
        [period, branchId, listed],
    );
    return rows.flatMap((row) => {
        const premium = amount(row.premium);
        if (premium === null) {
            return [];
        }
        return [{ branchId: row.branchId, employeeId: row.employeeId, activeFrom: row.activeFrom, premium }];
    });
}

async function readRetainedShares(query: PremiumQuery, period: string, from: string, until: string, branchId: string | null = null, listed: string[] | null = null): Promise<FrozenShare[]> {
    const rows = await query<{ branchId: string; employeeId: string; activeFrom: string; premium: number | string }>(
        `
        SELECT share.branch_uuid AS "branchId",
               share.employee_uuid AS "employeeId",
               to_char(share.active_from, 'YYYY-MM-DD') AS "activeFrom",
               share.premium::float8 AS premium
        FROM main.shared_premiums share
        WHERE share.period = $1::date
          AND ($4::uuid IS NULL OR share.branch_uuid = $4::uuid)
          AND ($5::uuid[] IS NULL OR share.branch_uuid = ANY($5::uuid[]))
          AND (
              share.active_until < $2::date
              OR share.active_from > $3::date
              OR EXISTS (
                  SELECT 1
                  FROM main.premium_accruals accrual
                  WHERE accrual.period = share.period
                    AND accrual.employee_uuid = share.employee_uuid
                    AND (accrual.branch_uuid IS NULL OR accrual.branch_uuid = share.branch_uuid)
                    AND share.active_from <= accrual.active_until
                    AND share.active_until >= accrual.active_from
              )
              OR EXISTS (
                  SELECT 1
                  FROM closed_staff_segments closed
                  WHERE closed.employee_uuid = share.employee_uuid
                    AND closed.branch_uuid = share.branch_uuid
                    AND share.active_from <= closed.active_until
                    AND share.active_until >= closed.active_from
              )
          )
        `,
        [period, from, until, branchId, listed],
    );
    return rows.flatMap((row) => {
        const premium = amount(row.premium);
        if (premium === null) {
            return [];
        }
        return [{ branchId: row.branchId, employeeId: row.employeeId, activeFrom: row.activeFrom, premium }];
    });
}

async function readClosedSpans(query: PremiumQuery): Promise<LockedSpan[]> {
    return query<LockedSpan>(
        `
        SELECT employee_uuid AS "employeeId",
               branch_uuid AS "branchId",
               to_char(active_from, 'YYYY-MM-DD') AS "from",
               to_char(active_until, 'YYYY-MM-DD') AS "until"
        FROM closed_staff_segments
        `,
    );
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const id = key(row);
        const list = groups.get(id) ?? [];
        list.push(row);
        groups.set(id, list);
    }
    return groups;
}

function amount(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined) {
        return null;
    }
    const number = typeof value === "number" ? value : Number(value);
    return Number.isFinite(number) ? number : null;
}
