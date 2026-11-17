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
