export const WIZARD_SAVE_STAGES = [
    { id: "guard", label: "Проверяем период" },
    { id: "read", label: "Читаем текущую карточку" },
    { id: "baskets", label: "Записываем корзины" },
    { id: "motivation", label: "Записываем участие филиалов" },
    { id: "brigades", label: "Записываем бригады" },
    { id: "coefficients", label: "Записываем коэффициенты" },
    { id: "tariffs", label: "Записываем тарифы" },
    { id: "recalc", label: "Ставим пересчёт" },
] as const;

export type WizardSaveStage = (typeof WIZARD_SAVE_STAGES)[number]["id"];

export type WizardSaveStepState = "wait" | "run" | "done";

export interface WizardSaveStep {
    id: WizardSaveStage;
    label: string;
    state: WizardSaveStepState;
}

export function initialWizardSaveProgress(): WizardSaveStep[] {
    return WIZARD_SAVE_STAGES.map((step, index) => ({
        id: step.id,
        label: step.label,
        state: index === 0 ? "run" : "wait",
    }));
}

export function wizardSaveProgressAt(stage: WizardSaveStage): WizardSaveStep[] {
    const index = WIZARD_SAVE_STAGES.findIndex((step) => step.id === stage);
    return WIZARD_SAVE_STAGES.map((step, stepIndex) => ({
        id: step.id,
        label: step.label,
        state: stepIndex < index ? "done" : stepIndex === index ? "run" : "wait",
    }));
}

export function finishedWizardSaveProgress(): WizardSaveStep[] {
    return WIZARD_SAVE_STAGES.map((step) => ({
        id: step.id,
        label: step.label,
        state: "done",
    }));
}

export function isWizardSaveStage(value: unknown): value is WizardSaveStage {
    return WIZARD_SAVE_STAGES.some((step) => step.id === value);
}
