import type { BrigadeIndicator } from "@/lib/brigade-shares";
import type { RecalcScopeLevel } from "@/lib/recalc-reasons";
import {
    assertPremiumRecalcRunning,
    beginPremiumRecalc,
    failPremiumRecalc,
    finishPremiumRecalc,
    PremiumRecalcCancelledError,
    type BasketUpdateKind,
} from "@/services/basket-updates";
import { calculateBrigadePremiums } from "@/services/brigade-premium";
import type { PremiumRun } from "@/services/sale-premium";

const INDICATOR_BY_KIND: Partial<Record<BasketUpdateKind, BrigadeIndicator>> = {
    sale: "Продажа товара",
    release: "Выдача товара",
    kassa: "Кассовые операции",
    osnt: "ОСНТ",
    warehouse: "Складские операции",
    unloading: "Разгрузка ТС",
    selection: "Набор товара",
    display: "Выставление товара",
};

export function brigadeIndicatorOf(kind: BasketUpdateKind): BrigadeIndicator | null {
    return INDICATOR_BY_KIND[kind] ?? null;
}

type OperationalBasketKind = Exclude<BasketUpdateKind, "shared" | "tariffs" | "brigade">;

/** Закрывает корзину в журнале и следом пишет отдельную строку «Доли бригады». */
export async function followBasketWithBrigade(input: {
    kind: OperationalBasketKind;
    period: string;
    basketRunId: number;
    basketLines: number;
    actor: string;
    trigger: string;
    origin: "manual" | "system";
    route: string;
    announce?: boolean;
}): Promise<void> {
    const indicator = brigadeIndicatorOf(input.kind);
    await finishPremiumRecalc(input.basketRunId, input.basketLines, {
        announce: indicator ? false : input.announce,
    });
    if (!indicator) {
        return;
    }
    await runBrigadeJournal({
        period: input.period,
        indicators: [indicator],
        actor: input.actor,
        trigger: input.trigger,
        origin: input.origin,
        scopeLevel: "division",
        route: input.route,
        announce: input.announce,
    });
}

export interface QueuedBrigade {
    indicators: BrigadeIndicator[];
    scopeLevel: RecalcScopeLevel;
    scopeIds: string[];
    conditions?: string;
    run?: PremiumRun;
}

/** Копит показатели одного охвата, чтобы посчитать их одним запуском. */
export function queueBrigadeIndicator(
    batches: Map<string, QueuedBrigade>,
    item: {
        indicator: BrigadeIndicator;
        scopeLevel: RecalcScopeLevel;
        scopeIds: readonly string[];
        conditions?: string;
        run?: PremiumRun;
    },
): void {
    const scopeIds = [...item.scopeIds].sort();
    const branches = item.run?.branch
        ? `one:${item.run.branch.toLowerCase()}`
        : item.run?.branches
            ? [...item.run.branches].map((id) => id.toLowerCase()).sort().join(",")
            : "*";
    const window = item.run?.from && item.run.until ? `${item.run.from}..${item.run.until}` : "";
    const key = `${item.scopeLevel}|${scopeIds.join(",")}|${branches}|${window}|${item.conditions ?? ""}`;
    const existing = batches.get(key);
    if (existing) {
        existing.indicators.push(item.indicator);
        return;
    }
    batches.set(key, {
        indicators: [item.indicator],
        scopeLevel: item.scopeLevel,
        scopeIds,
        conditions: item.conditions,
        run: item.run,
    });
}

/** Один запуск журнала на каждый охват. Пустая очередь ничего не пишет. */
export async function flushQueuedBrigades(input: {
    batches: Map<string, QueuedBrigade>;
    period: string;
    actor: string;
    trigger: string;
    origin: "manual" | "system";
    route: string;
    announce: boolean;
}): Promise<void> {
    const list = [...input.batches.values()];
    input.batches.clear();
    for (let index = 0; index < list.length; index += 1) {
        const batch = list[index];
        await runBrigadeJournal({
            period: input.period,
            indicators: batch.indicators,
            actor: input.actor,
            trigger: input.trigger,
            origin: input.origin,
            scopeLevel: batch.scopeLevel,
            scopeIds: batch.scopeIds,
            conditions: batch.conditions,
            route: input.route,
            run: batch.run,
            announce: input.announce && index === list.length - 1,
        });
    }
}

/** Отдельный запуск «Доли бригады» в журнале после связанного пересчёта корзины. */
export async function runBrigadeJournal(input: {
    period: string;
    indicators: readonly BrigadeIndicator[];
    actor: string;
    trigger: string;
    origin: "manual" | "system";
    scopeLevel: RecalcScopeLevel;
    scopeIds?: string[];
    conditions?: string;
    route: string;
    run?: PremiumRun;
    announce?: boolean;
}): Promise<number> {
    if (input.indicators.length === 0) {
        return 0;
    }
    const runId = await beginPremiumRecalc({
        kind: "brigade",
        period: input.period,
        origin: input.origin,
        trigger: input.trigger,
        actor: input.actor,
        scopeLevel: input.scopeLevel,
        scopeIds: input.scopeIds,
        conditions: input.conditions,
    });
    try {
        const lines = await calculateBrigadePremiums(input.period, input.indicators, input.run);
        await assertPremiumRecalcRunning(runId);
        await finishPremiumRecalc(runId, lines, { announce: input.announce });
        return lines;
    } catch (error) {
        if (!(error instanceof PremiumRecalcCancelledError)) {
            await failPremiumRecalc(runId, error, input.route, { announce: input.announce });
        }
        throw error;
    }
}
