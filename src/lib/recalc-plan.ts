"use client";

import { useEffect, useState } from "react";
import type { StartedPremiumRecalc } from "@/lib/premium-recalc-notice";
import { recalcReasonLabel, type RecalcScopeLevel } from "@/lib/recalc-reasons";
import type { BasketUpdateKind } from "@/services/basket-updates";

export const RECALC_PLAN_KEY = "srp-monitoring-recalc-queue";
export const RECALC_CONSOLE_EVENT = "srp-recalc-console";

export interface RecalcPlan {
    period: string;
    kinds: BasketUpdateKind[];
    startedAt: string;
    reason: string;
    actor: string;
    scopeLevel: RecalcScopeLevel;
    scopeLabel: string;
    title: string;
    detail: string;
}

interface PlanEvent {
    period: string;
    kind: string;
    createdAt: string;
    status: string;
    actor: string;
    trigger?: string;
}

const LAUNCH_SKEW_MS = 1000;

/** События именно этого запуска. Чужой триггер и более ранний запуск того же вида не снимают шаг из очереди. */
export function planLaunchEvents(plan: RecalcPlan, events: readonly PlanEvent[]): PlanEvent[] {
    const started = new Date(plan.startedAt).getTime() - LAUNCH_SKEW_MS;
    const period = plan.period.slice(0, 10);
    return events.filter((event) => {
        const created = new Date(event.createdAt).getTime();
        if (event.period.slice(0, 10) !== period || Number.isNaN(created) || created < started) {
            return false;
        }
        if (plan.actor !== "" && event.actor.toLowerCase() !== plan.actor.toLowerCase()) {
            return false;
        }
        return plan.reason === "" || event.trigger === undefined || event.trigger === plan.reason;
    });
}

export function showStartedRecalc(notice: StartedPremiumRecalc, startedAt?: string): void {
    const kinds = notice.trigger === "tariffs" && !notice.kinds.includes("brigade")
        ? [...notice.kinds, "brigade" as const]
        : notice.kinds;
    openRecalcConsole({
        period: notice.period,
        kinds,
        reason: notice.trigger,
        actor: notice.actor,
        scopeLevel: notice.scopeLevel,
        scopeLabel: notice.scopeLabel,
        title: `${notice.scopeLabel}, ${recalcReasonLabel(notice.trigger, "manual")}`,
        startedAt,
    });
}

export function openRecalcConsole(input: Omit<RecalcPlan, "startedAt" | "detail"> & { detail?: string; startedAt?: string }): RecalcPlan {
    const plan: RecalcPlan = { ...input, detail: input.detail ?? "", startedAt: input.startedAt ?? new Date().toISOString() };
    writePlans([...readRecalcPlans(), plan]);
    window.dispatchEvent(new CustomEvent(RECALC_CONSOLE_EVENT, { detail: { open: true } }));
    return plan;
}

/** Без startedAt снимает только последний запуск: более ранний месяц в очереди остаётся. */
export function clearRecalcPlan(startedAt?: string): void {
    const plans = readRecalcPlans();
    const next = startedAt
        ? plans.filter((plan) => plan.startedAt !== startedAt)
        : plans.slice(0, -1);
    writePlans(next);
    window.dispatchEvent(new CustomEvent(RECALC_CONSOLE_EVENT, { detail: { open: false } }));
}

export function readRecalcPlans(): RecalcPlan[] {
    const raw = sessionStorage.getItem(RECALC_PLAN_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
        const list = Array.isArray(parsed) ? parsed : [parsed];
        const plans = list.flatMap((item) => {
            const plan = normalizePlan(item);
            return plan ? [plan] : [];
        });
        if (plans.length !== list.length) {
            writePlans(plans);
        }
        return plans;
    } catch {
        sessionStorage.removeItem(RECALC_PLAN_KEY);
        return [];
    }
}

export function readRecalcPlan(): RecalcPlan | null {
    return readRecalcPlans()[0] ?? null;
}

export function syncRecalcPlans(events: PlanEvent[]): RecalcPlan[] {
    const current = readRecalcPlans();
    if (current.length === 0) {
        return [];
    }
    let changed = false;
    const next = current.flatMap((plan) => {
        const fresh = planLaunchEvents(plan, events);
        const blocked = fresh.some((event) => event.status === "failed" || event.status === "cancelled");
        const kinds = blocked ? [] : plan.kinds.filter((kind) => !fresh.some((event) => event.kind === kind));
        if (kinds.length === plan.kinds.length && !blocked) {
            return [plan];
        }
        changed = true;
        return kinds.length === 0 ? [] : [{ ...plan, kinds }];
    });
    if (changed) {
        writePlans(next);
        window.dispatchEvent(new CustomEvent(RECALC_CONSOLE_EVENT, { detail: { open: false } }));
    }
    return next;
}

export function syncRecalcPlan(events: PlanEvent[]): RecalcPlan | null {
    return syncRecalcPlans(events)[0] ?? null;
}

export function useRecalcPlans(): RecalcPlan[] {
    const [plans, setPlans] = useState<RecalcPlan[]>([]);
    useEffect(() => {
        const read = () => setPlans(readRecalcPlans());
        read();
        window.addEventListener(RECALC_CONSOLE_EVENT, read);
        return () => window.removeEventListener(RECALC_CONSOLE_EVENT, read);
    }, []);
    return plans;
}

export function useRecalcPlan(): RecalcPlan | null {
    return useRecalcPlans()[0] ?? null;
}

function writePlans(plans: RecalcPlan[]): void {
    if (plans.length === 0) {
        sessionStorage.removeItem(RECALC_PLAN_KEY);
        return;
    }
    sessionStorage.setItem(RECALC_PLAN_KEY, JSON.stringify(plans));
}

function normalizePlan(value: unknown): RecalcPlan | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const plan = value as Partial<RecalcPlan>;
    if (typeof plan.period !== "string" || typeof plan.startedAt !== "string" || !Array.isArray(plan.kinds) || !startedOnMoscowToday(plan.startedAt)) {
        return null;
    }
    const kinds = plan.kinds.filter(isRecalcKind);
    if (kinds.length === 0) {
        return null;
    }
    return {
        period: plan.period,
        kinds,
        startedAt: plan.startedAt,
        reason: typeof plan.reason === "string" ? plan.reason : "",
        actor: typeof plan.actor === "string" ? plan.actor : "",
        scopeLevel: plan.scopeLevel === "territory" || plan.scopeLevel === "branch" ? plan.scopeLevel : "division",
        scopeLabel: typeof plan.scopeLabel === "string" ? plan.scopeLabel : "",
        title: typeof plan.title === "string" ? plan.title : "",
        detail: typeof plan.detail === "string" ? plan.detail : "",
    };
}

function startedOnMoscowToday(iso: string): boolean {
    const started = new Date(iso);
    if (Number.isNaN(started.getTime())) {
        return false;
    }
    const format = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" });
    return format.format(started) === format.format(new Date());
}

function isRecalcKind(kind: unknown): kind is BasketUpdateKind {
    return kind === "sale"
        || kind === "release"
        || kind === "kassa"
        || kind === "osnt"
        || kind === "warehouse"
        || kind === "unloading"
        || kind === "selection"
        || kind === "display"
        || kind === "shared"
        || kind === "tariffs"
        || kind === "brigade";
}
