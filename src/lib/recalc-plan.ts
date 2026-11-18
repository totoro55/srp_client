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

export function openRecalcConsole(input: Omit<RecalcPlan, "startedAt" | "detail"> & { detail?: string; startedAt?: string }): void {
    const plan: RecalcPlan = { ...input, detail: input.detail ?? "", startedAt: input.startedAt ?? new Date().toISOString() };
    sessionStorage.setItem(RECALC_PLAN_KEY, JSON.stringify(plan));
    window.dispatchEvent(new CustomEvent(RECALC_CONSOLE_EVENT, { detail: { open: true } }));
}

export function clearRecalcPlan(): void {
    sessionStorage.removeItem(RECALC_PLAN_KEY);
    window.dispatchEvent(new CustomEvent(RECALC_CONSOLE_EVENT, { detail: { open: false } }));
}

export function readRecalcPlan(): RecalcPlan | null {
    const raw = sessionStorage.getItem(RECALC_PLAN_KEY);
    if (!raw) {
        return null;
    }
    try {
        const plan = JSON.parse(raw) as Partial<RecalcPlan>;
        if (typeof plan.period !== "string" || typeof plan.startedAt !== "string" || !Array.isArray(plan.kinds) || !startedOnMoscowToday(plan.startedAt)) {
            sessionStorage.removeItem(RECALC_PLAN_KEY);
            return null;
        }
        const kinds = plan.kinds.filter(isRecalcKind);
        if (kinds.length === 0) {
            sessionStorage.removeItem(RECALC_PLAN_KEY);
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
    } catch {
        sessionStorage.removeItem(RECALC_PLAN_KEY);
        return null;
    }
}

export function syncRecalcPlan(events: PlanEvent[]): RecalcPlan | null {
    const plan = readRecalcPlan();
    if (!plan) {
        return null;
    }
    const fresh = planLaunchEvents(plan, events);
    const blocked = fresh.some((event) => event.status === "failed" || event.status === "cancelled");
    const kinds = blocked ? [] : plan.kinds.filter((kind) => !fresh.some((event) => event.kind === kind));
    if (!blocked && kinds.length === plan.kinds.length) {
        return plan;
    }
    if (kinds.length === 0) {
        sessionStorage.removeItem(RECALC_PLAN_KEY);
    } else {
        sessionStorage.setItem(RECALC_PLAN_KEY, JSON.stringify({ ...plan, kinds }));
    }
    window.dispatchEvent(new CustomEvent(RECALC_CONSOLE_EVENT, { detail: { open: false } }));
    return kinds.length === 0 ? null : { ...plan, kinds };
}

export function useRecalcPlan(): RecalcPlan | null {
    const [plan, setPlan] = useState<RecalcPlan | null>(null);
    useEffect(() => {
        const read = () => setPlan(readRecalcPlan());
        read();
        window.addEventListener(RECALC_CONSOLE_EVENT, read);
        return () => window.removeEventListener(RECALC_CONSOLE_EVENT, read);
    }, []);
    return plan;
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
        || kind === "shared"
        || kind === "tariffs"
        || kind === "brigade";
}
