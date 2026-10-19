import { parseTerritoryUuid } from "@/lib/rrs";

export interface TariffAlgorithmTerritory {
    uuid: string;
    code: string;
    name: string;
}

export interface TariffAlgorithmBasket {
    id: number;
    name: string;
    versionId: number;
    versionNo: number;
    versionName: string;
    status: "draft" | "test" | "working" | "off";
}

export interface TariffAlgorithmSettings {
    code: string;
    title: string;
    salesShareWeight: number;
    priceShareWeight: number;
    territoryUuids: string[];
    referenceTerritoryUuids: string[];
    baskets: TariffAlgorithmBasket[];
}

export interface TariffAlgorithmPage {
    algorithms: TariffAlgorithmSettings[];
    territories: TariffAlgorithmTerritory[];
}

export interface TariffAlgorithmInput {
    code: string;
    salesShareWeight: number;
    priceShareWeight: number;
    territoryUuids: string[];
    referenceTerritoryUuids: string[];
}

export function parseTariffAlgorithmInputs(value: unknown): TariffAlgorithmInput[] | { error: string } {
    if (!value || typeof value !== "object") {
        return { error: "Проверьте настройки алгоритмов" };
    }
    const algorithms = (value as { algorithms?: unknown }).algorithms;
    if (!Array.isArray(algorithms) || algorithms.length === 0) {
        return { error: "Проверьте настройки алгоритмов" };
    }
    const items: TariffAlgorithmInput[] = [];
    const seen = new Set<string>();
    for (const item of algorithms) {
        if (!item || typeof item !== "object") {
            return { error: "Проверьте настройки алгоритмов" };
        }
        const record = item as Record<string, unknown>;
        if (typeof record.code !== "string" || !/^[a-z0-9_]{1,20}$/.test(record.code)) {
            return { error: "Неизвестный алгоритм" };
        }
        if (seen.has(record.code)) {
            return { error: "Один и тот же алгоритм указан дважды" };
        }
        seen.add(record.code);
        const salesShareWeight = readWeight(record.salesShareWeight);
        const priceShareWeight = readWeight(record.priceShareWeight);
        if (salesShareWeight === null || priceShareWeight === null || salesShareWeight + priceShareWeight !== 100) {
            return { error: "Вес делится между количеством в продажах и средней стоимостью и в сумме даёт 100" };
        }
        const territoryUuids = readTerritoryUuids(record.territoryUuids);
        const referenceTerritoryUuids = readTerritoryUuids(record.referenceTerritoryUuids);
        if ("error" in territoryUuids) {
            return territoryUuids;
        }
        if ("error" in referenceTerritoryUuids) {
            return referenceTerritoryUuids;
        }
        items.push({ code: record.code, salesShareWeight, priceShareWeight, territoryUuids, referenceTerritoryUuids });
    }
    return items;
}

function readTerritoryUuids(value: unknown): string[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Проверьте список территорий" };
    }
    const territoryUuids: string[] = [];
    const territories = new Set<string>();
    for (const territory of value) {
        const uuid = parseTerritoryUuid(territory);
        if (!uuid || territories.has(uuid)) {
            return { error: "Проверьте список территорий" };
        }
        territories.add(uuid);
        territoryUuids.push(uuid);
    }
    return territoryUuids;
}

function readWeight(value: unknown): number | null {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
        return null;
    }
    return value;
}
