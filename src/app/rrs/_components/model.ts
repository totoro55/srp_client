import type { BasketParameter } from "@/lib/baskets";
import { connectableVersions, resolveConnectionValues, withCalculatedValues, type RrsBasketOffer, type RrsConnectionSlice, type RrsHistoryChange, type RrsHistoryEvent, type RrsVersionOffer } from "@/lib/rrs";

export interface BasketForm {
    basketId: number;
    connected: boolean;
    versionId: number | null;
    values: Record<string, string>;
}

const MONTHS_NOMINATIVE = [
    "январь", "февраль", "март", "апрель", "май", "июнь",
    "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

const MONTHS_GENITIVE = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export function currentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonth(period: string): string {
    const [year, month] = period.split("-");
    return `${MONTHS_NOMINATIVE[Number(month) - 1]} ${year}`;
}

export function formatMonthFrom(period: string): string {
    const [year, month] = period.split("-");
    return `${MONTHS_GENITIVE[Number(month) - 1]} ${year}`;
}

export function formatCalendarDate(iso: string): string {
    const [year, month, day] = iso.split("-");
    return `${Number(day)} ${MONTHS_GENITIVE[Number(month) - 1]} ${year}`;
}

export interface HistoryDiffRow {
    title: string;
    before: string;
    after: string;
    changed: boolean;
}

export interface HistoryDiffBasket {
    basketId: number;
    basketName: string;
    beforeVersion: string;
    afterVersion: string;
    versionChanged: boolean;
    rows: HistoryDiffRow[];
}

export interface HistoryStep {
    id: string;
    at: string;
    by: string;
    period: string;
    baskets: HistoryDiffBasket[];
}

const EMPTY_VALUE = "—";

export function buildHistorySteps(events: RrsHistoryEvent[]): HistoryStep[] {
    const saves = events
        .filter((event) => !event.replaced)
        .sort((left, right) => left.at.localeCompare(right.at) || left.period.localeCompare(right.period));
    const priorBySave = new Map<RrsHistoryEvent, RrsHistoryEvent>();
    const used = new Set<RrsHistoryEvent>();
    for (const save of saves) {
        const prior = events.find((event) => event.replaced && !used.has(event) && event.period === save.period && event.at === save.at);
        if (prior) {
            used.add(prior);
            priorBySave.set(save, prior);
        }
    }

    const carried = new Map<number, { version: string; values: Map<string, string> }>();
    const steps: HistoryStep[] = [];
    for (const save of saves) {
        const priorChanges = new Map((priorBySave.get(save)?.changes ?? []).map((change) => [change.basketId, change]));
        steps.push({
            id: `${save.at}|${save.period}|${save.by}`,
            at: save.at,
            by: save.by,
            period: save.period,
            baskets: save.changes.map((change) => diffBasket(change, priorChanges.get(change.basketId), carried.get(change.basketId))),
        });
        for (const change of save.changes) {
            carried.set(change.basketId, {
                version: change.versionLabel ?? "Отключена",
                values: new Map(change.values.map((item) => [item.title, item.value])),
            });
        }
    }
    return steps.reverse();
}

function diffBasket(
    change: RrsHistoryChange,
    logged: RrsHistoryChange | undefined,
    carried: { version: string; values: Map<string, string> } | undefined,
): HistoryDiffBasket {
    const beforeValues = new Map(logged
        ? logged.values.map((item) => [item.title, item.value])
        : carried ? [...carried.values] : []);
    const afterValues = new Map(change.values.map((item) => [item.title, item.value]));
    const titles = [...new Set([...beforeValues.keys(), ...afterValues.keys()])];
    const beforeVersion = logged
        ? logged.versionLabel ?? "Отключена"
        : carried?.version ?? EMPTY_VALUE;
    const afterVersion = change.versionLabel ?? "Отключена";
    return {
        basketId: change.basketId,
        basketName: change.basketName,
        beforeVersion,
        afterVersion,
        versionChanged: (logged || carried ? beforeVersion : EMPTY_VALUE) !== afterVersion,
        rows: titles.map((title) => {
            const before = beforeValues.get(title) ?? EMPTY_VALUE;
            const after = afterValues.get(title) ?? EMPTY_VALUE;
            return { title, before, after, changed: before !== after };
        }).filter((row) => row.before !== EMPTY_VALUE || row.after !== EMPTY_VALUE),
    };
}

export type PeriodEffectKind = "current" | "past" | "future";

export function describePeriodEffect(card: {
    period: string;
    appliedPeriod: string | null;
    savedPeriods: { period: string }[];
}): {
    kind: PeriodEffectKind;
    title: string;
    detail: string;
} {
    const next = card.savedPeriods
        .map((item) => item.period)
        .filter((period) => period > card.period)
        .sort()[0];
    if (!card.appliedPeriod || card.period > card.appliedPeriod) {
        return { kind: "future", title: "Будущие", detail: `с ${formatCalendarDate(card.period)}` };
    }
    const end = next ? previousDay(next) : null;
    const detail = end
        ? `с ${formatSpanStart(card.period, end)} по ${formatCalendarDate(end)}`
        : `с ${formatCalendarDate(card.period)} по настоящее время`;
    const current = card.period === card.appliedPeriod;
    return {
        kind: current ? "current" : "past",
        title: current ? "Текущие" : "Прошлые",
        detail,
    };
}

function formatSpanStart(fromIso: string, toIso: string): string {
    const [fromYear, fromMonth, fromDay] = fromIso.split("-");
    const [toYear] = toIso.split("-");
    if (fromYear === toYear) {
        return `${Number(fromDay)} ${MONTHS_GENITIVE[Number(fromMonth) - 1]}`;
    }
    return formatCalendarDate(fromIso);
}

function previousDay(iso: string): string {
    const [year, month, day] = iso.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
    const nextDay = String(date.getDate()).padStart(2, "0");
    return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function formatSavedAt(value: string): string {
    return new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export function preferredVersion(basket: RrsBasketOffer, versionId: number | null): RrsVersionOffer | undefined {
    const selected = versionId === null ? undefined : basket.versions.find((version) => version.id === versionId);
    if (selected) {
        return selected;
    }
    const open = basket.versions.filter((version) => version.status !== "off");
    return [...open].reverse().find((version) => version.status === "working")
        ?? open[open.length - 1];
}

export function valuesFor(version: RrsVersionOffer | undefined, connection: RrsConnectionSlice | undefined): Record<string, string> {
    const values: Record<string, string> = {};
    if (!version) {
        return values;
    }
    for (const parameter of version.parameters) {
        const stored = connection?.versionId === version.id ? connection.values?.[parameter.key] : undefined;
        values[parameter.key] = stored ?? "";
    }
    return withCalculatedValues(version.parameters, values);
}

export function basketsForTerritory(
    baskets: RrsBasketOffer[],
    territoryUuid: string,
    connections: RrsConnectionSlice[],
): RrsBasketOffer[] {
    return baskets.flatMap((basket) => {
        const connection = connections.find((item) => item.basketId === basket.id);
        const versions = connectableVersions(basket, territoryUuid, connection?.versionId ?? null);
        if (versions.length === 0) {
            return [];
        }
        return [{ ...basket, versions }];
    });
}

export function formsForTerritory(
    baskets: RrsBasketOffer[],
    connections: RrsConnectionSlice[],
    territoryUuid: string,
    previous: BasketForm[],
): BasketForm[] {
    return basketsForTerritory(baskets, territoryUuid, connections).map((basket) => {
        const [built] = buildForms([basket], connections);
        const prior = previous.find((form) => form.basketId === basket.id);
        if (!built || !prior || !basket.versions.some((version) => version.id === prior.versionId)) {
            return built;
        }
        return {
            ...prior,
            connected: basket.mandatory || prior.connected,
        };
    }).filter((form): form is BasketForm => form !== undefined);
}

export function buildForms(baskets: RrsBasketOffer[], connections: RrsConnectionSlice[]): BasketForm[] {
    return baskets.map((basket) => {
        const connection = connections.find((item) => item.basketId === basket.id);
        const wasConnected = connection?.versionId != null;
        const offered = basket.versions.some((item) => item.id === connection?.versionId);
        const version = preferredVersion(basket, offered ? connection?.versionId ?? null : null);
        return {
            basketId: basket.id,
            connected: basket.mandatory || wasConnected,
            versionId: version?.id ?? null,
            values: valuesFor(offered ? version : undefined, offered ? connection : undefined),
        };
    });
}

export function fieldMissing(parameter: BasketParameter, value: string | undefined): boolean {
    if (parameter.kind === "number" && parameter.formula) {
        return false;
    }
    return (value ?? "").trim().length === 0;
}

export function connectionIssues(parameters: BasketParameter[], values: Record<string, string>) {
    return resolveConnectionValues(parameters, withCalculatedValues(parameters, values)).issues;
}

export function formBlocked(baskets: RrsBasketOffer[], forms: BasketForm[]): boolean {
    return forms.some((form) => {
        if (!form.connected) {
            return false;
        }
        const basket = baskets.find((item) => item.id === form.basketId);
        const version = basket?.versions.find((item) => item.id === form.versionId);
        if (!version) {
            return true;
        }
        return connectionIssues(version.parameters, form.values).length > 0;
    });
}

export const selectClassName = "h-9 w-full rounded-md border bg-background px-3 text-sm";
