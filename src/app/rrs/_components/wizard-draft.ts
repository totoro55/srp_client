import type { BasketForm } from "./model";
import type { RrsBasketOffer, RrsBranch } from "@/lib/rrs";

const PREFIX = "srp:rrs-wizard:v1";

export interface WizardDraft {
    v: 1;
    territoryUuid: string;
    month: string;
    step: number;
    forms: BasketForm[];
    enabled: Record<string, boolean>;
    coefficients: Record<string, string>;
    savedAt: string;
}

export interface DraftRestore {
    forms: BasketForm[];
    enabled: Record<string, boolean>;
    coefficients: Record<string, string>;
    step: number;
    notes: string[];
}

export function draftStorageKey(username: string, territoryUuid: string, month: string): string {
    return `${PREFIX}:${username}:${territoryUuid.toLowerCase()}:${month}`;
}

export function readDraft(username: string, territoryUuid: string, month: string): WizardDraft | null {
    return readKey(draftStorageKey(username, territoryUuid, month));
}

export function writeDraft(username: string, draft: Omit<WizardDraft, "v" | "savedAt">): void {
    const payload: WizardDraft = { ...draft, v: 1, savedAt: new Date().toISOString() };
    localStorage.setItem(draftStorageKey(username, draft.territoryUuid, draft.month), JSON.stringify(payload));
}

export function deleteDraft(username: string, territoryUuid: string, month: string): void {
    localStorage.removeItem(draftStorageKey(username, territoryUuid, month));
}

export function restoreDraft(
    draft: WizardDraft,
    baskets: RrsBasketOffer[],
    baseForms: BasketForm[],
    branches: RrsBranch[],
): DraftRestore {
    const notes: string[] = [];
    const basketById = new Map(baskets.map((basket) => [basket.id, basket]));
    let droppedBaskets = 0;
    let droppedVersions = 0;
    let droppedParameters = 0;
    const forms = baseForms.map((form) => {
        const stored = draft.forms.find((item) => item.basketId === form.basketId);
        const basket = basketById.get(form.basketId);
        if (!stored || !basket) {
            if (stored) {
                droppedBaskets += 1;
            }
            return form;
        }
        const version = basket.versions.find((item) => item.id === stored.versionId);
        if (stored.versionId !== null && !version) {
            droppedVersions += 1;
            return form;
        }
        const allowed = new Set((version?.parameters ?? []).map((parameter) => parameter.key));
        const values: Record<string, string> = {};
        for (const [key, value] of Object.entries(stored.values)) {
            if (!allowed.has(key)) {
                droppedParameters += 1;
                continue;
            }
            values[key] = value;
        }
        for (const key of allowed) {
            if (values[key] === undefined) {
                values[key] = form.values[key] ?? "";
            }
        }
        return {
            basketId: form.basketId,
            connected: basket.mandatory || stored.connected,
            versionId: version?.id ?? form.versionId,
            values,
        };
    });
    const knownBranches = new Set(branches.map((branch) => branch.uuid.toLowerCase()));
    let droppedBranches = 0;
    const enabled: Record<string, boolean> = {};
    for (const branch of branches) {
        enabled[branch.uuid] = draft.enabled[branch.uuid] ?? draft.enabled[branch.uuid.toLowerCase()] ?? false;
    }
    for (const uuid of Object.keys(draft.enabled)) {
        if (!knownBranches.has(uuid.toLowerCase())) {
            droppedBranches += 1;
        }
    }
    const allowedCoefficients = new Set<string>();
    for (const form of forms) {
        if (!form.connected || form.versionId === null) {
            continue;
        }
        const basket = basketById.get(form.basketId);
        const version = basket?.versions.find((item) => item.id === form.versionId);
        for (const branch of branches) {
            if (!enabled[branch.uuid]) {
                continue;
            }
            for (const coefficient of version?.coefficients ?? []) {
                allowedCoefficients.add(`${branch.uuid}:${form.basketId}:${coefficient.key}`);
            }
        }
    }
    let droppedCoefficients = 0;
    const coefficients: Record<string, string> = {};
    for (const [key, value] of Object.entries(draft.coefficients)) {
        if (!allowedCoefficients.has(key)) {
            droppedCoefficients += 1;
            continue;
        }
        coefficients[key] = value;
    }
    if (droppedBaskets > 0) {
        notes.push("Часть корзин из черновика больше нельзя подключить, они не восстановлены.");
    }
    if (droppedVersions > 0) {
        notes.push("Версии некоторых корзин изменились. Для них оставлены значения сохранённой карточки.");
    }
    if (droppedParameters > 0) {
        notes.push("Параметры, которых больше нет в выбранной версии, не восстановлены.");
    }
    if (droppedBranches > 0) {
        notes.push("Участие филиалов, которых больше нет на территории, не восстановлено.");
    }
    if (droppedCoefficients > 0) {
        notes.push("Коэффициенты, которых нет у выбранных версий или у выключенных филиалов, не восстановлены.");
    }
    return { forms, enabled, coefficients, step: draft.step, notes };
}

function readKey(key: string): WizardDraft | null {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw) as Partial<WizardDraft>;
        if (parsed.v !== 1 || typeof parsed.territoryUuid !== "string" || typeof parsed.month !== "string" || !Array.isArray(parsed.forms)) {
            return null;
        }
        return {
            v: 1,
            territoryUuid: parsed.territoryUuid,
            month: parsed.month,
            step: typeof parsed.step === "number" ? parsed.step : 0,
            forms: parsed.forms,
            enabled: parsed.enabled ?? {},
            coefficients: parsed.coefficients ?? {},
            savedAt: parsed.savedAt ?? "",
        };
    } catch {
        return null;
    }
}
