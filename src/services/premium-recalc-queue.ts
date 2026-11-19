import { formatScopeLabel, type RecalcScopeLevel } from "@/lib/recalc-reasons";
import { premiumMonthHasStarted, type AnnouncedRecalcKind, type PremiumRecalcKind, type StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { buildRrsEditPolicy, monthIsOpen } from "@/lib/rrs-edit-window";
import { getAppSettings } from "@/services/app-settings";
import { recalcTimeoutMs } from "@/lib/recalc-timeout";
import {
    assertPremiumRecalcRunning,
    beginPremiumRecalc,
    failPremiumRecalc,
    finishPremiumRecalc,
    PremiumRecalcBusyError,
    PremiumRecalcCancelledError,
} from "@/services/basket-updates";
import { BRIGADE_INDICATORS } from "@/lib/brigade-shares";
import { brigadeIndicatorOf, flushQueuedBrigades, queueBrigadeIndicator, type QueuedBrigade } from "@/services/brigade-recalc";
import { db } from "@/services/db";
import { calculateKassaPremium } from "@/services/kassa-premium";
import { calculateOsntPremium } from "@/services/osnt-premium";
import { calculateReleasePremium } from "@/services/release-premium";
import { calculateSalePremium, type PremiumRun } from "@/services/sale-premium";
import { calculateSharedPremium } from "@/services/shared-premium";
import { calculateDisplayPremium } from "@/services/display-premium";
import { calculateSelectionPremium } from "@/services/product-selection-premium";
import { calculateUnloadingPremium } from "@/services/unloading-premium";
import { calculateWarehousePremium } from "@/services/warehouse-premium";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PERIOD = /^\d{4}-\d{2}-01$/;
const ORDER: PremiumRecalcKind[] = ["sale", "release", "kassa", "osnt", "warehouse", "unloading", "selection", "display", "shared"];
const RETRY_MS = 5_000;

const KIND_BY_INDICATOR: Record<string, Exclude<PremiumRecalcKind, "shared">> = {
    "Продажа товара": "sale",
    "Выдача товара": "release",
    "Кассовые операции": "kassa",
    "ОСНТ": "osnt",
    "Складские операции": "warehouse",
    "Разгрузка ТС": "unloading",
    "Набор товара": "selection",
    "Выставление товара": "display",
};

export function premiumKindOf(indicatorName: string): Exclude<PremiumRecalcKind, "shared"> | null {
    return KIND_BY_INDICATOR[indicatorName] ?? null;
}

export interface PremiumScopePlan {
    period: string;
    actor: string;
    trigger: string;
    origin?: "manual" | "system";
    route?: string;
    /** Пусто — весь дивизион. */
    territoryId: string | null;
    territoryKinds: readonly PremiumRecalcKind[];
    branchKinds: ReadonlyMap<PremiumRecalcKind, readonly string[]>;
    /** Филиалы, чьи доли бригады нужно посчитать, даже если корзины по ним не стоят в очереди. */
    brigadeBranches?: readonly string[];
}

interface KindScope {
    all: boolean;
    branches: Set<string>;
}

interface Job {
    period: string;
    territoryId: string | null;
    actor: string;
    trigger: string;
    origin: "manual" | "system";
    route: string;
    scopes: Map<PremiumRecalcKind, KindScope>;
    extraBrigadeBranches: Set<string>;
    cachedBranches?: string[];
}

interface QueueState {
    jobs: Job[];
    pumping: boolean;
}

/** Ставит пересчёт в очередь и сразу возвращает описание. Страница расчёт не ждёт. */
export async function enqueuePremiumScopes(plan: PremiumScopePlan): Promise<StartedPremiumRecalc | null> {
    const territoryId = plan.territoryId?.toLowerCase() ?? null;
    const division = territoryId === null;
    const territoryKinds = uniqueKinds(plan.territoryKinds).filter((kind) => kind !== "shared");
    const branchKinds = new Map<PremiumRecalcKind, string[]>();
    if (!division) {
        for (const [kind, ids] of plan.branchKinds) {
            if (kind === "shared" || territoryKinds.includes(kind)) {
                continue;
            }
            const clean = [...new Set(ids.map((id) => id.toLowerCase()))].filter((id) => UUID.test(id));
            if (clean.length > 0) {
                branchKinds.set(kind, clean);
            }
        }
    }
    const brigadeBranches = [...new Set((plan.brigadeBranches ?? []).map((id) => id.toLowerCase()))].filter((id) => UUID.test(id));
    if (territoryKinds.length === 0 && branchKinds.size === 0 && brigadeBranches.length === 0) {
        return null;
    }
    if (!await premiumRecalcEligible(plan.period)) {
        return null;
    }
    const job = absorbPlan(plan, territoryId, territoryKinds, branchKinds, brigadeBranches);
    void pump();
    return describe(job);
}

async function premiumRecalcEligible(period: string): Promise<boolean> {
    if (!PERIOD.test(period) || !premiumMonthHasStarted(period)) {
        return false;
    }
    const settings = await getAppSettings();
    return monthIsOpen(period.slice(0, 7), buildRrsEditPolicy(settings.rrsEditCutoffDay));
}

function absorbPlan(
    plan: PremiumScopePlan,
    territoryId: string | null,
    territoryKinds: PremiumRecalcKind[],
    branchKinds: Map<PremiumRecalcKind, string[]>,
    brigadeBranches: string[],
): Job {
    const queue = state();
    for (const queued of queue.jobs) {
        queued.extraBrigadeBranches ??= new Set();
    }
    const division = territoryId === null;
    if (division) {
        const covered = new Set<PremiumRecalcKind>([...territoryKinds, "shared"]);
        const coversBrigade = territoryKinds.some((kind) => brigadeIndicatorOf(kind));
        queue.jobs = queue.jobs.flatMap((job) => {
            if (job.period !== plan.period || job.territoryId === null) {
                return [job];
            }
            for (const kind of covered) {
                job.scopes.delete(kind);
            }
            if (coversBrigade) {
                job.extraBrigadeBranches.clear();
            }
            return job.scopes.size > 0 || job.extraBrigadeBranches.size > 0 ? [job] : [];
        });
    }
    const needed: PremiumRecalcKind[] = [...territoryKinds, ...branchKinds.keys(), "shared"];
    const divisionJob = queue.jobs.find((job) => job.period === plan.period && job.territoryId === null);
    const divisionBrigade = divisionJob ? [...divisionJob.scopes.keys()].some((kind) => brigadeIndicatorOf(kind)) : false;
    if (!division && divisionJob && needed.every((kind) => divisionJob.scopes.get(kind)?.all) && (brigadeBranches.length === 0 || divisionBrigade)) {
        divisionJob.actor = plan.actor;
        divisionJob.trigger = plan.trigger;
        divisionJob.origin = plan.origin ?? divisionJob.origin;
        divisionJob.route = plan.route ?? divisionJob.route;
        return divisionJob;
    }
    let job = queue.jobs.find((item) => item.period === plan.period && item.territoryId === territoryId);
    if (!job) {
        job = {
            period: plan.period,
            territoryId,
            actor: plan.actor,
            trigger: plan.trigger,
            origin: plan.origin ?? "manual",
            route: plan.route ?? "",
            scopes: new Map(),
            extraBrigadeBranches: new Set(),
        };
        queue.jobs.push(job);
    }
    for (const id of brigadeBranches) {
        job.extraBrigadeBranches.add(id);
    }
    for (const kind of territoryKinds) {
        job.scopes.set(kind, { all: true, branches: new Set() });
    }
    if (!division) {
        for (const [kind, ids] of branchKinds) {
            const current = job.scopes.get(kind);
            if (current?.all) {
                continue;
            }
            const branches = current?.branches ?? new Set<string>();
            for (const id of ids) {
                branches.add(id);
            }
            job.scopes.set(kind, { all: false, branches });
        }
    }
    if (territoryKinds.length > 0 || branchKinds.size > 0) {
        const widenShared = division || territoryKinds.length > 0 || [...job.scopes.values()].some((scope) => scope.all);
        if (widenShared) {
            job.scopes.set("shared", { all: true, branches: new Set() });
        } else {
            const shared = job.scopes.get("shared") ?? { all: false, branches: new Set<string>() };
            for (const ids of branchKinds.values()) {
                for (const id of ids) {
                    shared.branches.add(id);
                }
            }
            job.scopes.set("shared", shared);
        }
    }
    job.actor = plan.actor;
    job.trigger = plan.trigger;
    job.origin = plan.origin ?? "manual";
    job.route = plan.route ?? job.route;
    return job;
}

function state(): QueueState {
    const holder = globalThis as typeof globalThis & { __srpPremiumQueue?: QueueState };
    if (!holder.__srpPremiumQueue) {
        holder.__srpPremiumQueue = { jobs: [], pumping: false };
    }
    return holder.__srpPremiumQueue;
}

async function pump(): Promise<void> {
    const queue = state();
    if (queue.pumping) {
        return;
    }
    queue.pumping = true;
    try {
        while (queue.jobs.length > 0) {
            const job = queue.jobs.shift();
            if (!job) {
                break;
            }
            try {
                await runJob(job);
            } catch (error) {
                if (error instanceof PremiumRecalcBusyError) {
                    queue.jobs.unshift(job);
                    await delay(RETRY_MS);
                    continue;
                }
                console.error("Пересчёт премии после сохранения не выполнен", error);
            }
        }
    } finally {
        queue.pumping = false;
        if (queue.jobs.length > 0) {
            void pump();
        }
    }
}

async function runJob(job: Job): Promise<void> {
    job.extraBrigadeBranches ??= new Set();
    const kinds = ORDER.filter((kind) => job.scopes.has(kind));
    const brigadeFollows = kinds.some((kind) => brigadeIndicatorOf(kind));
    const brigades = new Map<string, QueuedBrigade>();
    const route = job.route || "очередь пересчёта";
    try {
        for (let index = 0; index < kinds.length; index += 1) {
            const kind = kinds[index];
            const scope = job.scopes.get(kind);
            if (!scope) {
                continue;
            }
            const branches = await resolveBranches(job, scope);
            const scopeLevel: RecalcScopeLevel = job.territoryId === null && scope.all
                ? "division"
                : scope.all
                    ? "territory"
                    : "branch";
            const scopeIds = scopeLevel === "division"
                ? []
                : scopeLevel === "territory" && job.territoryId
                    ? [job.territoryId]
                    : branches ?? [];
            const isLast = index === kinds.length - 1;
            const indicator = brigadeIndicatorOf(kind);
            let runId: number;
            try {
                runId = await beginPremiumRecalc({
                    kind,
                    period: job.period,
                    origin: job.origin,
                    trigger: job.trigger,
                    actor: job.actor,
                    scopeLevel,
                    scopeIds,
                });
            } catch (error) {
                if (error instanceof PremiumRecalcBusyError) {
                    for (const done of kinds.slice(0, index)) {
                        job.scopes.delete(done);
                    }
                }
                throw error;
            }
            try {
                const lines = await calculate(kind, job.period, branches, scopeLevel);
                await assertPremiumRecalcRunning(runId);
                await finishPremiumRecalc(runId, lines, { announce: isLast && !brigadeFollows });
            } catch (error) {
                if (!(error instanceof PremiumRecalcCancelledError)) {
                    await failPremiumRecalc(runId, error, route);
                }
                throw error;
            }
            if (!indicator) {
                continue;
            }
            queueBrigadeIndicator(brigades, {
                indicator,
                scopeLevel,
                scopeIds,
                run: {
                    ...(branches === null ? {} : { branches }),
                    timeoutMs: recalcTimeoutMs(scopeLevel),
                },
            });
        }
    } catch (error) {
        if (error instanceof PremiumRecalcCancelledError) {
            return;
        }
        try {
            attachExtraBrigades(job, brigades);
            await flushQueuedBrigades({
                batches: brigades,
                period: job.period,
                actor: job.actor,
                trigger: job.trigger,
                origin: job.origin,
                route,
                announce: false,
            });
            job.extraBrigadeBranches.clear();
        } catch (flushError) {
            if (!(flushError instanceof PremiumRecalcCancelledError)) {
                console.error("Не удалось записать доли бригады после прерванного пересчёта", flushError);
            }
        }
        throw error;
    }
    attachExtraBrigades(job, brigades);
    await flushQueuedBrigades({
        batches: brigades,
        period: job.period,
        actor: job.actor,
        trigger: job.trigger,
        origin: job.origin,
        route,
        announce: true,
    });
    job.extraBrigadeBranches.clear();
}

function attachExtraBrigades(job: Job, brigades: Map<string, QueuedBrigade>): void {
    const uncovered = [...job.extraBrigadeBranches].filter((id) => {
        return ![...brigades.values()].some((batch) => brigadeBatchCovers(batch, id));
    });
    if (uncovered.length === 0) {
        return;
    }
    for (const indicator of BRIGADE_INDICATORS) {
        queueBrigadeIndicator(brigades, {
            indicator,
            scopeLevel: "branch",
            scopeIds: uncovered,
            run: { branches: uncovered, timeoutMs: recalcTimeoutMs("branch") },
        });
    }
}

function brigadeBatchCovers(batch: QueuedBrigade, branchId: string): boolean {
    const run = batch.run;
    if (!run?.branch && !run?.branches) {
        return true;
    }
    if (run.branch?.toLowerCase() === branchId) {
        return true;
    }
    return run.branches?.some((id) => id.toLowerCase() === branchId) ?? false;
}

async function resolveBranches(job: Job, scope: KindScope): Promise<string[] | null> {
    if (!scope.all) {
        return [...scope.branches];
    }
    if (job.territoryId === null) {
        return null;
    }
    if (!job.cachedBranches) {
        job.cachedBranches = await territoryBranches(job.territoryId, job.period);
    }
    return job.cachedBranches;
}

async function territoryBranches(territoryId: string, period: string): Promise<string[]> {
    const rows = await db.query<{ uuid: string }>(
        `
        SELECT branch.uuid
        FROM branches branch
        WHERE branch.territory_uuid = $1::uuid
        UNION
        SELECT day.branch_uuid
        FROM main.basket_premium_days day
        WHERE day.period = $2::date
          AND day.territory_uuid = $1::uuid
        UNION
        SELECT share.branch_uuid
        FROM main.shared_premiums share
        WHERE share.period = $2::date
          AND share.territory_uuid = $1::uuid
        `,
        [territoryId, period],
    );
    return rows.map((row) => row.uuid);
}

function calculate(
    kind: PremiumRecalcKind,
    period: string,
    branches: string[] | null,
    scopeLevel: RecalcScopeLevel,
): Promise<number> {
    const run: PremiumRun = {
        ...(branches === null ? {} : { branches }),
        timeoutMs: recalcTimeoutMs(scopeLevel),
    };
    if (kind === "sale") {
        return calculateSalePremium(period, false, run);
    }
    if (kind === "release") {
        return calculateReleasePremium(period, false, run);
    }
    if (kind === "kassa") {
        return calculateKassaPremium(period, false, run);
    }
    if (kind === "osnt") {
        return calculateOsntPremium(period, false, run);
    }
    if (kind === "warehouse") {
        return calculateWarehousePremium(period, false, run);
    }
    if (kind === "unloading") {
        return calculateUnloadingPremium(period, false, run);
    }
    if (kind === "selection") {
        return calculateSelectionPremium(period, false, run);
    }
    if (kind === "display") {
        return calculateDisplayPremium(period, false, run);
    }
    return calculateSharedPremium(period, run);
}

async function describe(job: Job): Promise<StartedPremiumRecalc> {
    const kinds: AnnouncedRecalcKind[] = ORDER.filter((kind) => job.scopes.has(kind));
    job.extraBrigadeBranches ??= new Set();
    if (job.extraBrigadeBranches.size > 0 || kinds.some((kind) => kind !== "shared")) {
        kinds.push("brigade");
    }
    const division = job.territoryId === null;
    const territoryWide = !division && [...job.scopes.values()].some((scope) => scope.all);
    const scopeLevel: RecalcScopeLevel = division ? "division" : territoryWide ? "territory" : "branch";
    let names: string[] = [];
    if (scopeLevel === "territory" && job.territoryId) {
        const rows = await db.query<{ name: string }>(
            "SELECT name FROM territories WHERE uuid = $1::uuid",
            [job.territoryId],
        );
        names = rows[0] ? [rows[0].name] : [];
    } else if (scopeLevel === "branch") {
        const ids = new Set<string>();
        for (const scope of job.scopes.values()) {
            for (const id of scope.branches) {
                ids.add(id);
            }
        }
        for (const id of job.extraBrigadeBranches) {
            ids.add(id);
        }
        if (ids.size > 0) {
            const rows = await db.query<{ name: string }>(
                "SELECT name FROM branches WHERE uuid = ANY($1::uuid[]) ORDER BY name",
                [[...ids]],
            );
            names = rows.map((row) => row.name);
        }
    }
    return {
        period: job.period,
        kinds,
        scopeLevel,
        scopeLabel: formatScopeLabel(scopeLevel, names),
        trigger: job.trigger,
        actor: job.actor,
    };
}

function uniqueKinds(kinds: readonly PremiumRecalcKind[]): PremiumRecalcKind[] {
    return ORDER.filter((kind) => kinds.includes(kind));
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
