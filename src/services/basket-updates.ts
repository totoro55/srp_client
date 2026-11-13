import { escapeJournalLike, journalSearchTokens } from "@/lib/journal-query";
import { describeRecalcError, parseRecalcErrorDetail, type RecalcErrorDetail } from "@/lib/recalc-error";
import { formatScopeLabel, recalcReasonPhrase, recalcTriggersMatching, type RecalcScopeLevel } from "@/lib/recalc-reasons";
import { decideAccess } from "@/server/authz/match-access";
import { buildRrsEditPolicy, monthIsOpen } from "@/lib/rrs-edit-window";
import { getAppSettings } from "@/services/app-settings";
import { db } from "@/services/db";
import { notifyRecalc } from "@/services/notifications";

export type BasketUpdateKind = "sale" | "release" | "kassa" | "shared" | "tariffs";
export type RecalcRunStatus = "running" | "success" | "failed";
export type { RecalcScopeLevel };

export class PremiumRecalcBusyError extends Error {
    readonly status = 409;

    constructor() {
        super("Пересчёт этого снимка уже идёт");
        this.name = "PremiumRecalcBusyError";
    }
}

export interface JournalActor {
    login: string;
    name: string | null;
    role: string | null;
    branch: string | null;
    title: string | null;
}

export interface BasketRecalcRun {
    id: number;
    kind: BasketUpdateKind;
    period: string;
    origin: "system" | "manual";
    trigger: string;
    actor: string;
    actorPerson: JournalActor | null;
    lines: number | null;
    status: RecalcRunStatus;
    error: string;
    errorDetail: RecalcErrorDetail | null;
    createdAt: string;
    finishedAt: string | null;
    scopeLevel: RecalcScopeLevel;
    scopeIds: string[];
    scopeLabel: string;
    conditions: string;
}

export interface BasketUpdateMonth {
    period: string;
    sourceRows: number;
    snapshotLines: number;
    premium: number | null;
    calculatedAt: string | null;
    open: boolean;
    lastRun: BasketRecalcRun | null;
}

export interface SharedPremiumMonth {
    period: string;
    premium: number | null;
    calculatedAt: string | null;
    lastRun: BasketRecalcRun | null;
}

export interface BasketUpdate {
    id: number;
    name: string;
    indicator: string;
    kind: Exclude<BasketUpdateKind, "shared">;
    months: BasketUpdateMonth[];
    runs: BasketRecalcRun[];
}

export interface BasketCalculationBoard {
    baskets: BasketUpdate[];
    shared: SharedPremiumMonth[];
}

const KIND_BY_INDICATOR: Record<string, Exclude<BasketUpdateKind, "shared">> = {
    "Продажа товара": "sale",
    "Выдача товара": "release",
    "Кассовые операции": "kassa",
};

interface BasketRow {
    id: number;
    name: string;
    indicator: string;
}

interface CountRow {
    period: string;
    rows: number;
}

interface SnapshotRow {
    period: string;
    lines: number;
    premium: number;
    calculated_at: Date | null;
}

interface RunRow {
    id: number;
    basket_kind: BasketUpdateKind;
    period: string;
    origin: "system" | "manual";
    trigger_name: string;
    actor: string;
    lines: number | null;
    status: RecalcRunStatus;
    error_message: string;
    error_detail: unknown;
    created_at: Date;
    finished_at: Date | null;
    scope_level: RecalcScopeLevel;
    scope_ids: unknown;
    conditions: string;
}

const RUN_COLUMNS = `
    id,
    basket_kind,
    to_char(period, 'YYYY-MM-DD') AS period,
    origin,
    trigger_name,
    actor,
    lines,
    status,
    error_message,
    error_detail,
    created_at,
    finished_at,
    scope_level,
    scope_ids,
    conditions
`;

export async function readBasketUpdates(): Promise<BasketCalculationBoard> {
    const [settings, baskets, saleSource, releaseSource, kassaSource, saleSnapshot, releaseSnapshot, kassaSnapshot, sharedSnapshot, runs] = await Promise.all([
        getAppSettings(),
        db.query<BasketRow>(`
            SELECT basket.id,
                   basket.name,
                   indicator.name AS indicator
            FROM baskets basket
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE basket.status = 'active'
              AND indicator.name IN ('Продажа товара', 'Выдача товара', 'Кассовые операции')
            ORDER BY basket.sort_order, basket.id
        `),
        db.query<CountRow>(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows
            FROM raw.sale
            WHERE period IS NOT NULL
            GROUP BY period
        `),
        db.query<CountRow>(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows
            FROM raw.sale
            WHERE period IS NOT NULL
              AND author2 IS NOT NULL
            GROUP BY period
        `),
        db.query<CountRow>(`
            SELECT to_char(period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS rows
            FROM raw.kassa_oper
            WHERE period IS NOT NULL
            GROUP BY period
        `),
        db.query<SnapshotRow>(`
            SELECT to_char(day.period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS lines,
                   COALESCE(round(sum(day.premium), 2), 0)::float8 AS premium,
                   max(day.calculated_at) AS calculated_at
            FROM main.basket_premium_days day
            JOIN baskets basket ON basket.id = day.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE indicator.name = 'Продажа товара'
            GROUP BY day.period
        `),
        db.query<SnapshotRow>(`
            SELECT to_char(day.period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS lines,
                   COALESCE(round(sum(day.premium), 2), 0)::float8 AS premium,
                   max(day.calculated_at) AS calculated_at
            FROM main.basket_premium_days day
            JOIN baskets basket ON basket.id = day.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE indicator.name = 'Выдача товара'
            GROUP BY day.period
        `),
        db.query<SnapshotRow>(`
            SELECT to_char(day.period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS lines,
                   COALESCE(round(sum(day.premium), 2), 0)::float8 AS premium,
                   max(day.calculated_at) AS calculated_at
            FROM main.basket_premium_days day
            JOIN baskets basket ON basket.id = day.basket_id
            JOIN indicators indicator ON indicator.id = basket.indicator_id
            WHERE indicator.name = 'Кассовые операции'
            GROUP BY day.period
        `),
        db.query<SnapshotRow>(`
            SELECT to_char(share.period, 'YYYY-MM-DD') AS period,
                   count(*)::int AS lines,
                   COALESCE(round(sum(share.premium), 2), 0)::float8 AS premium,
                   max(share.calculated_at) AS calculated_at
            FROM main.shared_premiums share
            GROUP BY share.period
        `),
        db.query<RunRow>(`
            SELECT ${RUN_COLUMNS}
            FROM (
                SELECT run.*,
                       row_number() OVER (PARTITION BY basket_kind ORDER BY created_at DESC, id DESC) AS recent
                FROM premium_recalc_runs run
            ) ranked
            WHERE recent <= 100
        ORDER BY created_at DESC, id DESC
    `),
    ]);
    const history = await withScope(runs);
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    const sourceByKind = {
        sale: indexCounts(saleSource),
        release: indexCounts(releaseSource),
        kassa: indexCounts(kassaSource),
    };
    const snapshotByKind = {
        sale: indexSnapshots(saleSnapshot),
        release: indexSnapshots(releaseSnapshot),
        kassa: indexSnapshots(kassaSnapshot),
    };

    return {
        baskets: baskets.flatMap((basket) => {
            const kind = KIND_BY_INDICATOR[basket.indicator];
            if (!kind) {
                return [];
            }
            const source = sourceByKind[kind];
            const snapshot = snapshotByKind[kind];
            const basketRuns = history.filter((run) => run.kind === kind);
            const periods = [...new Set([...source.keys(), ...snapshot.keys()])].sort((left, right) => right.localeCompare(left));
            return [{
                id: basket.id,
                name: basket.name,
                indicator: basket.indicator,
                kind,
                months: periods.map((period) => {
                    const lines = snapshot.get(period);
                    return {
                        period,
                        sourceRows: source.get(period) ?? 0,
                        snapshotLines: lines?.lines ?? 0,
                        premium: lines ? lines.premium : null,
                        calculatedAt: lines?.calculatedAt ?? null,
                        open: monthIsOpen(period.slice(0, 7), policy),
                        lastRun: basketRuns.find((run) => run.period === period) ?? null,
                    };
                }),
                runs: basketRuns,
            }];
        }),
        shared: sharedMonths(indexSnapshots(sharedSnapshot), history.filter((run) => run.kind === "shared")),
    };
}

function sharedMonths(
    snapshot: Map<string, { lines: number; premium: number; calculatedAt: string | null }>,
    runs: BasketRecalcRun[],
): SharedPremiumMonth[] {
    const periods = [...new Set([...snapshot.keys(), ...runs.map((run) => run.period)])];
    return periods.map((period) => {
        const lines = snapshot.get(period);
        return {
            period,
            premium: lines ? lines.premium : null,
            calculatedAt: lines?.calculatedAt ?? null,
            lastRun: runs.find((run) => run.period === period) ?? null,
        };
    });
}

const JOURNAL_PAGE = 40;
const JOURNAL_KINDS: BasketUpdateKind[] = ["sale", "release", "kassa", "shared", "tariffs"];
const JOURNAL_STATUSES: RecalcRunStatus[] = ["running", "success", "failed"];

export function parseJournalBasket(value: string | null | undefined): BasketUpdateKind | null {
    return JOURNAL_KINDS.includes(value as BasketUpdateKind) ? value as BasketUpdateKind : null;
}

export function parseJournalStatus(value: string | null | undefined): RecalcRunStatus | null {
    return JOURNAL_STATUSES.includes(value as RecalcRunStatus) ? value as RecalcRunStatus : null;
}

function journalSearchSql(params: unknown[], tokens: string[]): string {
    if (tokens.length === 0) {
        return "";
    }
    const clauses = tokens.map((token) => {
        params.push(escapeJournalLike(token));
        const like = `$${params.length}`;
        params.push(recalcTriggersMatching(token));
        const triggers = `$${params.length}`;
        const parts = [
            `run.actor ILIKE '%' || ${like} || '%' ESCAPE '\\'`,
            `run.conditions ILIKE '%' || ${like} || '%' ESCAPE '\\'`,
            `run.error_message ILIKE '%' || ${like} || '%' ESCAPE '\\'`,
            `run.error_detail::text ILIKE '%' || ${like} || '%' ESCAPE '\\'`,
            `EXISTS (
                SELECT 1
                FROM employees employee
                WHERE lower(employee.login) = lower(run.actor)
                  AND (
                      employee.name ILIKE '%' || ${like} || '%' ESCAPE '\\'
                      OR employee.title ILIKE '%' || ${like} || '%' ESCAPE '\\'
                  )
            )`,
            `run.trigger_name ILIKE '%' || ${like} || '%' ESCAPE '\\'`,
            `run.trigger_name = ANY(${triggers}::text[])`,
            `EXISTS (
                SELECT 1
                FROM branches branch
                WHERE run.scope_level = 'branch'
                  AND branch.uuid = ANY(run.scope_ids)
                  AND branch.name ILIKE '%' || ${like} || '%' ESCAPE '\\'
            )`,
            `EXISTS (
                SELECT 1
                FROM territories territory
                WHERE run.scope_level = 'territory'
                  AND territory.uuid = ANY(run.scope_ids)
                  AND territory.name ILIKE '%' || ${like} || '%' ESCAPE '\\'
            )`,
            ...journalWordMatches(token),
        ];
        return `(${parts.join(" OR ")})`;
    });
    return `AND ${clauses.join(" AND ")}`;
}

function journalDateSql(params: unknown[], from: string | null, to: string | null): string {
    const parts: string[] = [];
    if (from) {
        params.push(from);
        parts.push(`run.created_at >= ($${params.length}::date::timestamp AT TIME ZONE 'Europe/Moscow')`);
    }
    if (to) {
        params.push(to);
        parts.push(`run.created_at < (($${params.length}::date + 1)::timestamp AT TIME ZONE 'Europe/Moscow')`);
    }
    return parts.length === 0 ? "" : `AND ${parts.join(" AND ")}`;
}

function journalWordMatches(token: string): string[] {
    if (token.length < 3) {
        return [];
    }
    const needle = token.toLocaleLowerCase("ru-RU");
    const hit = (label: string) => label.toLocaleLowerCase("ru-RU").includes(needle);
    const parts: string[] = [];
    if (hit("дивизион")) {
        parts.push("run.scope_level = 'division'");
    }
    if (hit("филиал")) {
        parts.push("run.scope_level = 'branch'");
    }
    if (hit("ррс")) {
        parts.push("run.scope_level = 'territory'");
    }
    if (hit("продажа")) {
        parts.push("run.basket_kind = 'sale'");
    }
    if (hit("выдача")) {
        parts.push("run.basket_kind = 'release'");
    }
    if (hit("касса") || hit("кассовые")) {
        parts.push("run.basket_kind = 'kassa'");
    }
    if (hit("премия")) {
        parts.push("run.basket_kind = 'shared'");
    }
    if (hit("тариф")) {
        parts.push("run.basket_kind = 'tariffs'");
    }
    if (hit("ошибка")) {
        parts.push("run.status = 'failed'");
    }
    if (hit("таймаут")) {
        parts.push("run.error_detail->>'type' = 'timeout'");
    }
    if (hit("соединен")) {
        parts.push("run.error_detail->>'type' = 'connection'");
    }
    if (hit("база данных") || hit("sqlstate") || needle === "sql") {
        parts.push("run.error_detail->>'type' = 'database'");
    }
    if (hit("занято")) {
        parts.push("run.error_detail->>'type' = 'busy'");
    }
    if (hit("внутренняя")) {
        parts.push("run.error_detail->>'type' = 'internal'");
    }
    if (hit("проверка")) {
        parts.push("run.error_detail->>'type' = 'check'");
    }
    if (hit("готово")) {
        parts.push("run.status = 'success'");
    }
    if (hit("идёт") || hit("идет")) {
        parts.push("run.status = 'running'");
    }
    if (hit("вручную")) {
        parts.push("run.origin = 'manual'");
    }
    if (hit("система")) {
        parts.push("run.origin = 'system'");
    }
    return parts;
}

export async function readRewriteJournal(
    before: number | null = null,
    kind: BasketUpdateKind | null = null,
    status: RecalcRunStatus | null = null,
    query: string | null = null,
    from: string | null = null,
    to: string | null = null,
): Promise<{ events: BasketRecalcRun[]; hasMore: boolean }> {
    const tokens = journalSearchTokens(query);
    const pageParams: unknown[] = [before, JOURNAL_PAGE + 1, kind, status];
    const pageSearch = `${journalSearchSql(pageParams, tokens)} ${journalDateSql(pageParams, from, to)}`;
    const page = await db.query<RunRow>(
        `
        SELECT ${RUN_COLUMNS}
        FROM premium_recalc_runs run
        WHERE ($1::bigint IS NULL OR run.id < $1::bigint)
          AND ($3::text IS NULL OR run.basket_kind = $3)
          AND ($4::text IS NULL OR run.status = $4)
          ${pageSearch}
        ORDER BY run.id DESC
        LIMIT $2
        `,
        pageParams,
    );
    const hasMore = page.length > JOURNAL_PAGE;
    const visible = page.slice(0, JOURNAL_PAGE);
    // Идущий запуск может быть старше последней порции. На общем журнале его оставляем сверху.
    // При фильтре по статусу порция уже состоит только из этого статуса.
    const runningParams: unknown[] = [kind];
    let runningId = "";
    if (visible.length > 0) {
        runningParams.push(visible.map((row) => row.id));
        runningId = `AND NOT (run.id = ANY($${runningParams.length}::bigint[]))`;
    }
    const runningSearch = `${journalSearchSql(runningParams, tokens)} ${journalDateSql(runningParams, from, to)}`;
    const running = before === null && status === null
        ? await db.query<RunRow>(
            `
            SELECT ${RUN_COLUMNS}
            FROM premium_recalc_runs run
            WHERE run.status = 'running'
              AND ($1::text IS NULL OR run.basket_kind = $1)
              ${runningId}
              ${runningSearch}
            `,
            runningParams,
        )
        : [];
    const rows = [...running, ...visible].sort((left, right) => {
        const time = left.created_at.getTime() - right.created_at.getTime();
        return time !== 0 ? time : left.id - right.id;
    });
    return { events: await withScope(rows), hasMore };
}

export async function readActorRecalcJournal(actor: string): Promise<BasketRecalcRun[]> {
    const rows = await db.query<RunRow>(
        `
        SELECT ${RUN_COLUMNS}
        FROM premium_recalc_runs
        WHERE lower(actor) = lower($1)
          -- Значок в шапке: только то, что этот человек запустил сегодня по Москве.
          AND created_at >= ((NOW() AT TIME ZONE 'Europe/Moscow')::date) AT TIME ZONE 'Europe/Moscow'
          AND created_at < (((NOW() AT TIME ZONE 'Europe/Moscow')::date + 1) AT TIME ZONE 'Europe/Moscow')
        ORDER BY created_at ASC, id ASC
        LIMIT 100
        `,
        [actor],
    );
    return withScope(rows);
}

export async function beginPremiumRecalc(input: {
    kind: BasketUpdateKind;
    period: string;
    origin: "system" | "manual";
    trigger: string;
    actor: string;
    scopeLevel: RecalcScopeLevel;
    scopeIds?: string[];
    conditions?: string;
}): Promise<number> {
    const scopeIds = (input.scopeIds ?? []).filter((id) => UUID.test(id));
    const conditions = (input.conditions ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
    try {
        const rows = await db.query<{ id: number }>(
            `
            INSERT INTO premium_recalc_runs (
                basket_kind, period, origin, trigger_name, actor, status, scope_level, scope_ids, conditions
            )
            VALUES ($1, $2::date, $3, $4, $5, 'running', $6, $7::uuid[], $8)
            RETURNING id
            `,
            [input.kind, input.period, input.origin, input.trigger, input.actor, input.scopeLevel, scopeIds, conditions],
        );
        return rows[0].id;
    } catch (error) {
        if (isActiveRunConflict(error)) {
            throw new PremiumRecalcBusyError();
        }
        throw error;
    }
}

export async function finishPremiumRecalc(id: number, lines: number, options?: { announce?: boolean }): Promise<void> {
    const rows = await db.query<RunNoticeRow>(FINISH_RETURNING, [id, lines]);
    if (rows[0] && options?.announce !== false) {
        await announceFinished(rows[0], "success", "");
    }
}

export async function failPremiumRecalc(id: number, error: unknown, route?: string | null, options?: { announce?: boolean }): Promise<void> {
    const described = typeof error === "string"
        ? describeRecalcError(new Error(error), route)
        : describeRecalcError(error, route);
    const rows = await db.query<RunNoticeRow>(FAIL_RETURNING, [id, described.summary, JSON.stringify(described.detail)]);
    if (rows[0] && options?.announce !== false) {
        await announceFinished(rows[0], "failed", described.summary);
    }
}

export function systemTrigger(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    return value.replace(/\s+/g, " ").trim().slice(0, 200);
}

function indexCounts(rows: CountRow[]): Map<string, number> {
    return new Map(rows.map((row) => [row.period, row.rows]));
}

function indexSnapshots(rows: SnapshotRow[]): Map<string, { lines: number; premium: number; calculatedAt: string | null }> {
    return new Map(rows.map((row) => [row.period, {
        lines: row.lines,
        premium: Number(row.premium),
        calculatedAt: row.calculated_at ? row.calculated_at.toISOString() : null,
    }]));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOTICE_COLUMNS = `
    id,
    basket_kind,
    to_char(period, 'YYYY-MM-DD') AS period,
    origin,
    trigger_name,
    actor,
    scope_level,
    scope_ids
`;

const FINISH_RETURNING = `
    UPDATE premium_recalc_runs
    SET status = 'success',
        lines = $2,
        error_message = '',
        finished_at = NOW()
    WHERE id = $1
      AND status = 'running'
    RETURNING ${NOTICE_COLUMNS}
`;

const FAIL_RETURNING = `
    UPDATE premium_recalc_runs
    SET status = 'failed',
        error_message = $2,
        error_detail = $3::jsonb,
        finished_at = NOW()
    WHERE id = $1
      AND status = 'running'
    RETURNING ${NOTICE_COLUMNS}
`;

interface RunNoticeRow {
    id: number;
    basket_kind: BasketUpdateKind;
    period: string;
    origin: "system" | "manual";
    trigger_name: string;
    actor: string;
    scope_level: RecalcScopeLevel;
    scope_ids: unknown;
}

interface NameRow {
    id: string;
    name: string;
}

const monthFormat = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

async function withScope(rows: RunRow[]): Promise<BasketRecalcRun[]> {
    const [labels, people] = await Promise.all([
        scopeLabels(rows),
        journalActors(rows.map((row) => row.actor)),
    ]);
    return rows.map((row) => toRun(
        row,
        labels.get(row.id) ?? formatScopeLabel(scopeLevel(row.scope_level), []),
        people.get(row.actor.trim().toLowerCase()) ?? null,
    ));
}

async function journalActors(actors: string[]): Promise<Map<string, JournalActor>> {
    const logins = [...new Set(actors.map((actor) => actor.trim()).filter((actor) => actor !== ""))];
    if (logins.length === 0) {
        return new Map();
    }
    const rows = await db.query<{ login: string; name: string; title: string; branch: string | null }>(
        `
        SELECT DISTINCT ON (lower(employee.login))
               employee.login,
               employee.name,
               employee.title,
               branch.name AS branch
        FROM employees employee
        LEFT JOIN branches branch ON branch.uuid = employee.branch_uuid
        WHERE lower(employee.login) = ANY($1::text[])
        ORDER BY lower(employee.login), employee.deleted
        `,
        [logins.map((login) => login.toLowerCase())],
    );
    const byLogin = new Map(rows.map((row) => [row.login.toLowerCase(), row]));
    const people = await Promise.all(logins.map(async (login) => {
        const employee = byLogin.get(login.toLowerCase());
        const decision = await decideAccess(login, employee?.title ?? "");
        const person: JournalActor = {
            login,
            name: employee && employee.name.trim() !== "" ? employee.name.trim() : null,
            role: decision.role?.name ?? (decision.source === "conflict" ? "Конфликт правил" : null),
            branch: employee?.branch?.trim() || null,
            title: employee && employee.title.trim() !== "" ? employee.title.trim() : null,
        };
        return [login.toLowerCase(), person] as const;
    }));
    return new Map(people);
}

async function scopeLabels(rows: Array<{ id: number; scope_level: RecalcScopeLevel; scope_ids: unknown }>): Promise<Map<number, string>> {
    const branchIds = new Set<string>();
    const territoryIds = new Set<string>();
    for (const row of rows) {
        const ids = readIds(row.scope_ids);
        const bucket = row.scope_level === "branch" ? branchIds : row.scope_level === "territory" ? territoryIds : null;
        if (!bucket) {
            continue;
        }
        for (const id of ids) {
            bucket.add(id);
        }
    }
    const [branches, territories] = await Promise.all([
        lookupNames("branches", [...branchIds]),
        lookupNames("territories", [...territoryIds]),
    ]);
    return new Map(rows.map((row) => {
        const ids = readIds(row.scope_ids);
        const names = row.scope_level === "branch"
            ? ids.map((id) => branches.get(id) ?? "филиал не найден")
            : row.scope_level === "territory"
                ? ids.map((id) => territories.get(id) ?? "РРС не найдена")
                : [];
        return [row.id, formatScopeLabel(scopeLevel(row.scope_level), names)];
    }));
}

async function lookupNames(table: "branches" | "territories", ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
        return new Map();
    }
    const rows = await db.query<NameRow>(
        `SELECT uuid::text AS id, name FROM ${table} WHERE uuid = ANY($1::uuid[])`,
        [ids],
    );
    return new Map(rows.map((row) => [row.id.toLowerCase(), row.name]));
}

function toRun(row: RunRow, scopeLabel: string, actorPerson: JournalActor | null): BasketRecalcRun {
    return {
        id: row.id,
        kind: row.basket_kind,
        period: row.period,
        origin: row.origin,
        trigger: row.trigger_name,
        actor: row.actor,
        actorPerson: row.actor.trim() === "" ? null : actorPerson,
        lines: row.lines,
        status: row.status,
        error: row.error_message,
        errorDetail: parseRecalcErrorDetail(row.error_detail),
        createdAt: row.created_at.toISOString(),
        finishedAt: row.finished_at ? row.finished_at.toISOString() : null,
        scopeLevel: scopeLevel(row.scope_level),
        scopeIds: readIds(row.scope_ids),
        scopeLabel,
        conditions: row.conditions ?? "",
    };
}

function scopeLevel(value: string): RecalcScopeLevel {
    if (value === "territory" || value === "branch") {
        return value;
    }
    return "division";
}

function readIds(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).toLowerCase()).filter((id) => UUID.test(id));
    }
    if (typeof value !== "string" || value === "{}") {
        return [];
    }
    return value.replace(/^\{|\}$/g, "").split(",").map((item) => item.replaceAll("\"", "").trim().toLowerCase()).filter((id) => UUID.test(id));
}

async function announceFinished(row: RunNoticeRow, outcome: "success" | "failed", error: string): Promise<void> {
    if (row.origin !== "manual") {
        return;
    }
    try {
        const labels = await scopeLabels([row]);
        const scope = labels.get(row.id) ?? formatScopeLabel(scopeLevel(row.scope_level), []);
        const reason = recalcReasonPhrase(row.trigger_name, row.origin);
        const month = formatMonth(row.period);
        const tariffs = row.basket_kind === "tariffs";
        const lead = tariffs
            ? outcome === "success" ? "Тарифы продажи записаны" : "Тарифы продажи не записаны"
            : outcome === "success" ? "Пересчёт премии завершён" : "Пересчёт премии остановился";
        const detail = outcome === "failed" && error !== "" ? ` ${error}` : "";
        await notifyRecalc({
            actor: row.actor,
            runId: row.id,
            href: recalcHref(row),
            body: `${lead}. ${scope}, ${reason}, ${month}.${detail}`,
        });
    } catch (noticeError) {
        console.error("Не удалось отправить уведомление о пересчёте", noticeError);
    }
}

function recalcHref(row: RunNoticeRow): string {
    const ids = readIds(row.scope_ids);
    if (row.scope_level === "branch" && ids.length === 1) {
        return `/branch?branch=${ids[0]}&period=${row.period}`;
    }
    if (row.scope_level === "territory" && ids.length === 1) {
        return `/rrs/${ids[0]}`;
    }
    return "/admin/monitoring?tab=journal";
}

function formatMonth(period: string): string {
    const label = monthFormat.format(new Date(`${period}T00:00:00`));
    return label.charAt(0).toLowerCase() + label.slice(1);
}

function isActiveRunConflict(error: unknown): boolean {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "23505";
}
