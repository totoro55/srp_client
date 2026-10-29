import { SALES_INDICATOR_NAME } from "@/lib/baskets";
import { parseTariffReference, parseTariffSaveRows, type TariffReference, type TariffSaveRow } from "@/lib/tariff-calculation";
import { parseTariffWeightOverride } from "@/lib/tariff-exceptions";
import { parseRrsSaveInput, type RrsCoefficientValue, type RrsConnectionInput, type RrsMotivationItem } from "@/lib/rrs";
import type { AccessView } from "@/server/authz/resolve-access";
import { applyRrsMonth, guardRrsMonth, RrsRuleError } from "@/services/basket-connections";
import { prepareBranchMotivation, writeBranchMotivation } from "@/services/branch-motivation";
import { replacePeriodCoefficients } from "@/services/basket-coefficients";
import { db } from "@/services/db";
import { previewConnectionTariffs, writeWizardTariffs } from "@/services/tariff-exceptions";
import type { TariffExceptionPage } from "@/lib/tariff-exceptions";

export interface WizardTariffCommit {
    rows: TariffSaveRow[];
    reference: TariffReference;
    weights: { salesShareWeight: number; priceShareWeight: number } | null;
}

export interface WizardCommitInput {
    territoryUuid: string;
    period: string;
    items: RrsConnectionInput[];
    motivation: RrsMotivationItem[];
    coefficients: RrsCoefficientValue[];
    tariffs: WizardTariffCommit | null;
}

const BRANCH_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseWizardCommit(body: unknown): WizardCommitInput | { error: string } {
    const connections = parseRrsSaveInput(body);
    if (!connections || !body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "Проверьте РРС, месяц и набор корзин" };
    }
    const record = body as Record<string, unknown>;
    const motivation = parseMotivation(record.motivation);
    if ("error" in motivation) {
        return motivation;
    }
    const coefficients = parseCoefficients(record.coefficients);
    if ("error" in coefficients) {
        return coefficients;
    }
    const tariffs = parseTariffs(record.tariffs);
    if (tariffs && "error" in tariffs) {
        return tariffs;
    }
    return {
        territoryUuid: connections.territoryUuid,
        period: connections.period,
        items: connections.items,
        motivation,
        coefficients,
        tariffs,
    };
}

export function parseWizardPreview(body: unknown): { territoryUuid: string; period: string; items: RrsConnectionInput[] } | { error: string } {
    const connections = parseRrsSaveInput(body);
    if (!connections) {
        return { error: "Проверьте РРС, месяц и набор корзин" };
    }
    return connections;
}

function parseMotivation(value: unknown): RrsMotivationItem[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Передайте участие филиалов" };
    }
    const items: RrsMotivationItem[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return { error: "Передайте участие филиалов" };
        }
        const row = item as Record<string, unknown>;
        if (typeof row.branchUuid !== "string" || !BRANCH_UUID.test(row.branchUuid) || typeof row.enabled !== "boolean") {
            return { error: "Передайте участие филиалов" };
        }
        items.push({ branchUuid: row.branchUuid.toLowerCase(), enabled: row.enabled });
    }
    return items;
}

function parseCoefficients(value: unknown): RrsCoefficientValue[] | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Передайте коэффициенты филиалов" };
    }
    const items: RrsCoefficientValue[] = [];
    for (const item of value) {
        if (!item || typeof item !== "object") {
            return { error: "Передайте коэффициенты филиалов" };
        }
        const row = item as Record<string, unknown>;
        const basketId = typeof row.basketId === "number" ? row.basketId : Number.NaN;
        if (typeof row.branchUuid !== "string" || !BRANCH_UUID.test(row.branchUuid) || !Number.isInteger(basketId) || basketId <= 0) {
            return { error: "Передайте коэффициенты филиалов" };
        }
        if (typeof row.key !== "string" || !/^[a-z][a-z0-9_]*$/.test(row.key)) {
            return { error: "Передайте коэффициенты филиалов" };
        }
        if (typeof row.value !== "string" && typeof row.value !== "number") {
            return { error: "Передайте коэффициенты филиалов" };
        }
        items.push({ branchUuid: row.branchUuid.toLowerCase(), basketId, key: row.key, value: String(row.value) });
    }
    return items;
}

function parseTariffs(value: unknown): WizardTariffCommit | null | { error: string } {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "object" || Array.isArray(value)) {
        return { error: "Проверьте тарифы месяца" };
    }
    const record = value as Record<string, unknown>;
    const rows = parseTariffSaveRows(record.rows);
    if ("error" in rows) {
        return rows;
    }
    const reference = parseTariffReference(record.reference);
    if (typeof reference !== "string") {
        return reference;
    }
    const weights = parseTariffWeightOverride(record.weights);
    if (weights && "error" in weights) {
        return weights;
    }
    return { rows, reference, weights };
}

export async function previewWizardTariffs(
    access: AccessView,
    territoryUuid: string,
    period: string,
    items: RrsConnectionInput[],
): Promise<TariffExceptionPage> {
    const sales = await salesVersion(items);
    if (!sales) {
        throw new RrsRuleError(400, "Корзина продаж не включена");
    }
    return previewConnectionTariffs(access, territoryUuid, period, sales.versionId, sales.values);
}

export async function commitRrsWizard(access: AccessView, input: WizardCommitInput): Promise<void> {
    await guardRrsMonth(access, input.territoryUuid, input.period);
    const motivation = await prepareBranchMotivation(access, input.territoryUuid, input.period, input.motivation);
    await db.transaction(async (query) => {
        await applyRrsMonth(query, access, input.territoryUuid, input.period, input.items);
        await writeBranchMotivation(query, access.username, input.territoryUuid, motivation.period, motivation.items);
        await replacePeriodCoefficients(query, access.username, input.territoryUuid, input.period, input.coefficients);
        await writeWizardTariffs(query, access, input.territoryUuid, input.period, input.tariffs);
    });
}

async function salesVersion(items: RrsConnectionInput[]): Promise<{ versionId: number; values: Record<string, string> } | null> {
    const rows = await db.query<{ id: number }>(
        `
        SELECT basket.id
        FROM baskets basket
        JOIN indicators indicator ON indicator.id = basket.indicator_id
        WHERE indicator.name = $1
        `,
        [SALES_INDICATOR_NAME],
    );
    const salesId = rows[0]?.id;
    if (!salesId) {
        return null;
    }
    const item = items.find((candidate) => candidate.basketId === salesId && candidate.connected && candidate.versionId !== null);
    if (!item?.versionId) {
        return null;
    }
    return { versionId: item.versionId, values: item.values };
}
