import { buildRrsEditPolicy, closedPeriodMessage, monthIsOpen } from "@/lib/rrs-edit-window";
import { formatRecalcConditions, protectReasons, recalcWindowError, wholeMonth, type RecalcWindow } from "@/lib/recalc-window";
import { recalcTimeoutMs } from "@/lib/recalc-timeout";
import { replaceAuthorDays } from "@/services/author-days";
import { getAppSettings } from "@/services/app-settings";
import {
    assertPremiumRecalcRunning,
    beginPremiumRecalc,
    failPremiumRecalc,
    finishPremiumRecalc,
    PremiumRecalcCancelledError,
    type BasketUpdateKind,
} from "@/services/basket-updates";
import { db } from "@/services/db";
import { calculateKassaPremium } from "@/services/kassa-premium";
import { calculateReleasePremium } from "@/services/release-premium";
import { calculateSalePremium, SalePremiumError, type PremiumRun } from "@/services/sale-premium";
import { moscowToday } from "@/services/segment-locks";
import { calculateSharedPremium } from "@/services/shared-premium";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Корзины филиала, затем общая премия. Чужие филиалы не переписываются. График авторов не обновляется. */
export async function recalculateBranchPremiums(input: {
    period: string;
    branchId: string;
    actor: string;
    trigger: string;
    route: string;
}): Promise<void> {
    if (!UUID.test(input.branchId)) {
        throw new SalePremiumError("Укажите филиал");
    }
    const timeoutMs = recalcTimeoutMs("branch");
    const run: PremiumRun = { branch: input.branchId.toLowerCase(), timeoutMs };
    const steps: { kind: BasketUpdateKind; calculate: () => Promise<number> }[] = [
        { kind: "sale", calculate: () => calculateSalePremium(input.period, false, run) },
        { kind: "release", calculate: () => calculateReleasePremium(input.period, false, run) },
        { kind: "kassa", calculate: () => calculateKassaPremium(input.period, false, run) },
        { kind: "shared", calculate: () => calculateSharedPremium(input.period, run) },
    ];
    for (const [index, step] of steps.entries()) {
        const runId = await beginPremiumRecalc({
            kind: step.kind,
            period: input.period,
            origin: "manual",
            trigger: input.trigger,
            actor: input.actor,
            scopeLevel: "branch",
            scopeIds: [input.branchId],
        });
        try {
            const lines = await step.calculate();
            await assertPremiumRecalcRunning(runId);
            await finishPremiumRecalc(runId, lines, { announce: index === steps.length - 1 });
        } catch (error) {
            if (error instanceof PremiumRecalcCancelledError) {
                return;
            }
            await failPremiumRecalc(runId, error, input.route);
            throw error;
        }
    }
}

const PERIOD = /^\d{4}-\d{2}-01$/;

export type MonthRecalcTarget = "baskets" | Exclude<BasketUpdateKind, "tariffs">;

/** Одна корзина, все корзины или общая премия за выбранные даты. Ручной запуск всех корзин в конце считает общую премию. Штатное расписание собирается только для корзин за весь месяц. */
export async function recalculateMonthSelection(input: RecalcWindow & {
    target: MonthRecalcTarget;
    actor: string;
    trigger: string;
    origin: "manual" | "system";
    route: string;
}): Promise<void> {
    const windowError = recalcWindowError(input);
    if (windowError || !PERIOD.test(input.period)) {
        throw new SalePremiumError(windowError ?? "Укажите месяц");
    }
    const settings = await getAppSettings();
    const policy = buildRrsEditPolicy(settings.rrsEditCutoffDay);
    if (!monthIsOpen(input.period.slice(0, 7), policy)) {
        throw new SalePremiumError(closedPeriodMessage(policy));
    }
    const protect = protectReasons(input);
    const conditions = formatRecalcConditions(input);
    const singleBasket = input.target !== "baskets" && input.target !== "shared";
    const timeoutMs = recalcTimeoutMs("division", { singleBasket });
    const run: PremiumRun = { from: input.from, until: input.until, protect, timeoutMs };
    if (input.target !== "shared" && wholeMonth(input)) {
        await db.transaction(async (query) => {
            await query("SET LOCAL work_mem = '512MB'");
            await query(`SET LOCAL statement_timeout = ${timeoutMs}`);
            await replaceAuthorDays(query, input.period, moscowToday());
        });
    }
    const steps = selectionSteps(input.target, input.period, run);
    if (input.origin === "manual" && input.target === "baskets") {
        steps.push({ kind: "shared", calculate: () => calculateSharedPremium(input.period, run) });
    }
    for (const [index, step] of steps.entries()) {
        const runId = await beginPremiumRecalc({
            kind: step.kind,
            period: input.period,
            origin: input.origin,
            trigger: input.trigger,
            actor: input.actor,
            scopeLevel: "division",
            conditions,
        });
        try {
            const lines = await step.calculate();
            await assertPremiumRecalcRunning(runId);
            await finishPremiumRecalc(runId, lines, { announce: index === steps.length - 1 });
        } catch (error) {
            if (error instanceof PremiumRecalcCancelledError) {
                return;
            }
            await failPremiumRecalc(runId, error, input.route);
            throw error;
        }
    }
}

function selectionSteps(
    target: MonthRecalcTarget,
    period: string,
    run: PremiumRun,
): { kind: BasketUpdateKind; calculate: () => Promise<number> }[] {
    const sale = { kind: "sale" as const, calculate: () => calculateSalePremium(period, false, run) };
    const release = { kind: "release" as const, calculate: () => calculateReleasePremium(period, false, run) };
    const kassa = { kind: "kassa" as const, calculate: () => calculateKassaPremium(period, false, run) };
    if (target === "baskets") {
        return [sale, release, kassa];
    }
    if (target === "sale") {
        return [sale];
    }
    if (target === "release") {
        return [release];
    }
    if (target === "kassa") {
        return [kassa];
    }
    return [{ kind: "shared", calculate: () => calculateSharedPremium(period, run) }];
}
