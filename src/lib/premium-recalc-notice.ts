import type { RecalcScopeLevel } from "@/lib/recalc-reasons";

const MONTH_KEY = /^(\d{4})-(\d{2})/;

export type PremiumRecalcKind = "sale" | "release" | "kassa" | "shared";

export interface StartedPremiumRecalc {
    period: string;
    kinds: PremiumRecalcKind[];
    scopeLevel: RecalcScopeLevel;
    scopeLabel: string;
    trigger: string;
    actor: string;
}

export function premiumMonthHasStarted(period: string, now = new Date()): boolean {
    const match = MONTH_KEY.exec(period);
    if (!match) {
        return false;
    }
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Moscow",
        year: "numeric",
        month: "2-digit",
    }).formatToParts(now);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    return `${match[1]}-${match[2]}` <= `${year}-${month}`;
}

export function premiumSaveDescription(lead: string, period: string, followUp: string, now = new Date()): string {
    if (!premiumMonthHasStarted(period, now)) {
        return `${lead} Премия за будущий месяц не пересчитывается.`;
    }
    return `${lead} ${followUp}`;
}
