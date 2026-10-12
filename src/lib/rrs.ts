import type { BasketParameter } from "@/lib/baskets";
import type { RrsEditPolicy } from "@/lib/rrs-edit-window";

const TERRITORY_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RrsTerritory {
    uuid: string;
    code: string;
    name: string;
}

export interface RrsVersionOffer {
    id: number;
    versionNo: number;
    name: string;
    description: string;
    status: "test" | "working";
    parameters: BasketParameter[];
}

export interface RrsBasketOffer {
    id: number;
    code: string;
    name: string;
    description: string;
    indicatorName: string;
    mandatory: boolean;
    versions: RrsVersionOffer[];
}

export interface RrsConnectionSlice {
    basketId: number;
    versionId: number | null;
    period: string;
    values: Record<string, string> | null;
}

export interface RrsMonthState {
    baskets: RrsBasketOffer[];
    connections: RrsConnectionSlice[];
}

export interface RrsConnectedBasket {
    id: number;
    name: string;
    mandatory: boolean;
}

export interface RrsCardSummary {
    territory: RrsTerritory;
    period: string;
    baskets: RrsConnectedBasket[];
}

export interface RrsSavedPeriod {
    period: string;
    savedAt: string;
    savedBy: string;
}

export interface RrsHistoryValue {
    title: string;
    value: string;
}

export interface RrsHistoryChange {
    basketId: number;
    basketName: string;
    versionId: number | null;
    versionLabel: string | null;
    values: RrsHistoryValue[];
}

export interface RrsHistoryEvent {
    at: string;
    by: string;
    period: string;
    replaced: boolean;
    changes: RrsHistoryChange[];
}

export interface RrsCard extends RrsMonthState {
    territory: RrsTerritory;
    period: string;
    appliedPeriod: string | null;
    savedPeriods: RrsSavedPeriod[];
    editPolicy: RrsEditPolicy;
}

export interface RrsSetup {
    territories: RrsTerritory[];
    baskets: RrsBasketOffer[];
    editPolicy: RrsEditPolicy;
}

export interface RrsConnectionInput {
    basketId: number;
    connected: boolean;
    versionId: number | null;
    values: Record<string, string>;
}

export interface RrsSaveInput {
    territoryUuid: string;
    period: string;
    items: RrsConnectionInput[];
}

export function parseTerritoryUuid(value: unknown): string | null {
    if (typeof value !== "string" || !TERRITORY_UUID_PATTERN.test(value)) {
        return null;
    }
    return value.toLowerCase();
}

export function parseConnectionPeriod(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
    if (!match) {
        return null;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = match[3] === undefined ? 1 : Number(match[3]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12 || day !== 1) {
        return null;
    }
    return `${match[1]}-${match[2]}-01`;
}

export function parseConnectionValue(
    parameter: BasketParameter,
    raw: unknown,
): { value: string | number } | { error: string } {
    if (parameter.kind === "number") {
        if (typeof raw !== "string" && typeof raw !== "number") {
            return { error: `Укажите число «${parameter.title}»` };
        }
        const normalized = String(raw).trim().replace(",", ".");
        if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
            return { error: `«${parameter.title}» должно быть числом` };
        }
        const value = Number(normalized);
        if (!Number.isFinite(value)) {
            return { error: `«${parameter.title}» должно быть числом` };
        }
        if (parameter.constraints.integer && !Number.isInteger(value)) {
            return { error: `«${parameter.title}» должно быть целым` };
        }
        if (parameter.constraints.min !== null && value < parameter.constraints.min) {
            return { error: `«${parameter.title}» меньше допустимого` };
        }
        if (parameter.constraints.max !== null && value > parameter.constraints.max) {
            return { error: `«${parameter.title}» больше допустимого` };
        }
        return { value };
    }

    if (typeof raw !== "string") {
        return { error: `Заполните «${parameter.title}»` };
    }
    const value = raw.trim();
    if (value.length === 0) {
        return { error: `Заполните «${parameter.title}»` };
    }
    if (parameter.kind === "choice") {
        if (!parameter.options.includes(value)) {
            return { error: `Выберите значение «${parameter.title}»` };
        }
        return { value };
    }
    if (parameter.constraints.minLength !== null && value.length < parameter.constraints.minLength) {
        return { error: `«${parameter.title}» короче допустимого` };
    }
    if (parameter.constraints.maxLength !== null && value.length > parameter.constraints.maxLength) {
        return { error: `«${parameter.title}» длиннее допустимого` };
    }
    return { value };
}

export function parseRrsSaveInput(body: unknown): RrsSaveInput | null {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return null;
    }
    const record = body as Record<string, unknown>;
    const territoryUuid = parseTerritoryUuid(record.territoryUuid);
    const period = parseConnectionPeriod(record.period);
    if (!territoryUuid || !period || !Array.isArray(record.items)) {
        return null;
    }
    const items: RrsConnectionInput[] = [];
    for (const item of record.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
        }
        const row = item as Record<string, unknown>;
        const basketId = typeof row.basketId === "number" ? row.basketId : Number.NaN;
        const connected = row.connected;
        if (!Number.isInteger(basketId) || basketId <= 0 || typeof connected !== "boolean") {
            return null;
        }
        const versionId = row.versionId === null || row.versionId === undefined
            ? null
            : typeof row.versionId === "number" ? row.versionId : Number.NaN;
        if (versionId !== null && (!Number.isInteger(versionId) || versionId <= 0)) {
            return null;
        }
        if (!row.values || typeof row.values !== "object" || Array.isArray(row.values)) {
            return null;
        }
        const values: Record<string, string> = {};
        for (const [key, value] of Object.entries(row.values as Record<string, unknown>)) {
            if (typeof value !== "string" && typeof value !== "number") {
                return null;
            }
            values[key] = String(value);
        }
        items.push({ basketId, connected, versionId, values });
    }
    return { territoryUuid, period, items };
}
