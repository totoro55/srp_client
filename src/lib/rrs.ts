import type { BasketCoefficient, BasketParameter } from "@/lib/baskets";
import { compareCondition, conditionLabel, evaluateFormula, formatCalculated } from "@/lib/parameter-rules";
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
    status: "test" | "working" | "off";
    parameters: BasketParameter[];
    coefficients: BasketCoefficient[];
    testTerritoryUuids: string[];
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

export function connectableVersions(
    basket: RrsBasketOffer,
    territoryUuid: string,
    keepVersionId: number | null,
): RrsVersionOffer[] {
    return basket.versions.filter((version) => {
        if (version.status === "working") {
            return true;
        }
        // Уже подключённая версия остаётся в наборе, в том числе после перевода в архив.
        if (keepVersionId !== null && version.id === keepVersionId) {
            return true;
        }
        return version.status === "test" && version.testTerritoryUuids.some((uuid) => uuid.toLowerCase() === territoryUuid.toLowerCase());
    });
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
    sortOrder: number;
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

export interface RrsBranch {
    uuid: string;
    code: string;
    name: string;
}

export interface RrsCoefficientBasket {
    id: number;
    name: string;
    indicatorName: string;
    versionId: number;
    versionNo: number;
    versionName: string;
    coefficients: BasketCoefficient[];
}

export interface RrsCoefficientValue {
    branchUuid: string;
    basketId: number;
    key: string;
    value: string;
}

export interface RrsCoefficientPage {
    territory: RrsTerritory;
    period: string;
    editable: boolean;
    branches: RrsBranch[];
    baskets: RrsCoefficientBasket[];
    values: RrsCoefficientValue[];
    savedPeriods: string[];
    appliedPeriod: string | null;
    editPolicy: RrsEditPolicy;
}

export interface RrsMotivationItem {
    branchUuid: string;
    enabled: boolean;
}

export interface RrsMotivationPage {
    territory: RrsTerritory;
    period: string;
    editable: boolean;
    branches: RrsBranch[];
    items: RrsMotivationItem[];
    savedPeriods: string[];
    appliedPeriod: string | null;
    editPolicy: RrsEditPolicy;
}

export interface RrsFieldChange {
    title: string;
    before: string;
    after: string;
}

export interface RrsFieldChangeEvent {
    at: string;
    by: string;
    changes: RrsFieldChange[];
}

export interface RrsSetup {
    territories: RrsTerritory[];
    baskets: RrsBasketOffer[];
    editPolicy: RrsEditPolicy;
}

export type RrsTariffReadiness = "calculated" | "missing" | "no-sales" | "no-axis";

export interface RrsReadiness {
    territory: RrsTerritory;
    period: string;
    savedPeriods: string[];
    connectedBaskets: number;
    branches: { enabled: number; total: number };
    coefficients: { defined: number; saved: number; expected: number };
    tariffs: RrsTariffReadiness;
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

export interface ConnectionIssue {
    key: string;
    message: string;
}

export function resolveConnectionValues(
    parameters: BasketParameter[],
    raw: Record<string, string | number | undefined>,
): { values: Record<string, string | number>; issues: ConnectionIssue[] } {
    const values: Record<string, string | number> = {};
    const numbers = new Map<string, number>();
    const issues: ConnectionIssue[] = [];

    for (const parameter of parameters) {
        if (parameter.kind === "number" && parameter.formula) {
            const calculated = evaluateFormula(parameter.formula, numbers);
            if ("pending" in calculated) {
                if (issues.length === 0) {
                    issues.push({ key: parameter.key, message: `«${parameter.title}» не удалось посчитать` });
                }
                continue;
            }
            if ("error" in calculated) {
                issues.push({ key: parameter.key, message: `«${parameter.title}» не удалось посчитать: ${calculated.error}` });
                continue;
            }
            const parsed = parseConnectionValue(parameter, calculated.value);
            if ("error" in parsed) {
                issues.push({ key: parameter.key, message: parsed.error });
                continue;
            }
            values[parameter.key] = parsed.value;
            if (typeof parsed.value === "number") {
                numbers.set(parameter.key, parsed.value);
            }
            continue;
        }

        const parsed = parseConnectionValue(parameter, raw[parameter.key] ?? "");
        if ("error" in parsed) {
            issues.push({ key: parameter.key, message: parsed.error });
            continue;
        }
        values[parameter.key] = parsed.value;
        if (parameter.kind === "number" && typeof parsed.value === "number") {
            numbers.set(parameter.key, parsed.value);
        }
    }

    for (const parameter of parameters) {
        if (parameter.kind !== "number" || issues.some((issue) => issue.key === parameter.key)) {
            continue;
        }
        for (const condition of parameter.conditions) {
            const left = numbers.get(parameter.key);
            const right = numbers.get(condition.sourceKey);
            if (left === undefined || right === undefined || compareCondition(left, condition.operator, right)) {
                continue;
            }
            const source = parameters.find((item) => item.key === condition.sourceKey);
            issues.push({
                key: parameter.key,
                message: `«${parameter.title}» должно быть ${conditionLabel(condition.operator)} «${source?.title ?? condition.sourceKey}»`,
            });
            break;
        }
    }

    return { values, issues };
}

function looseNumber(raw: string): number | null {
    const normalized = raw.trim().replace(",", ".");
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
        return null;
    }
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
}

export function withCalculatedValues(
    parameters: BasketParameter[],
    raw: Record<string, string>,
): Record<string, string> {
    const next = { ...raw };
    const numbers = new Map<string, number>();
    for (const parameter of parameters) {
        if (parameter.kind === "number" && parameter.formula) {
            const calculated = evaluateFormula(parameter.formula, numbers);
            if (!("value" in calculated)) {
                next[parameter.key] = "";
                continue;
            }
            next[parameter.key] = formatCalculated(calculated.value);
            numbers.set(parameter.key, calculated.value);
            continue;
        }
        if (parameter.kind === "number") {
            const value = looseNumber(raw[parameter.key] ?? "");
            if (value !== null) {
                numbers.set(parameter.key, value);
            }
        }
    }
    return next;
}

export function formulaPreview(formula: string, parameters: BasketParameter[]): string {
    return formula.replace(/[a-z][a-z0-9_]*/g, (key) => parameters.find((item) => item.key === key)?.title ?? key);
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
