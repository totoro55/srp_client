export const BASKET_SETTINGS_SCHEMAS = [
    {
        code: "tariff",
        title: "Параметры директора",
        description: "Список полей, которые директор заполняет при включении корзины.",
    },
] as const;

export const INDICATOR_NAME_MAX = 255;

export const BASKET_NAME_MAX = 255;
export const BASKET_DESCRIPTION_MAX = 2000;
export const VERSION_NAME_MAX = 255;
export const VERSION_COMMENT_MAX = 2000;
export const PARAMETER_TITLE_MAX = 100;
export const PARAMETER_DESCRIPTION_MAX = 500;
export const PARAMETER_LIST_MAX = 30;
export const PARAMETER_OPTION_MAX = 100;
export const PARAMETER_OPTIONS_MAX = 30;
export const PARAMETER_TEXT_LENGTH_MAX = 2000;

export const PARAMETER_KINDS = [
    { code: "number", title: "Число" },
    { code: "text", title: "Текст" },
    { code: "choice", title: "Выбор из списка" },
] as const;

export type ParameterKind = (typeof PARAMETER_KINDS)[number]["code"];

const BASKET_CODE_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;
const PARAMETER_KEY_PATTERN = /^[a-z][a-z0-9_]{0,49}$/;

const RESERVED_PARAMETER_KEYS = new Set([
    "territory_uuid",
    "period",
    "connected_at",
    "connected_by",
    "recorded_at",
    "recorded_by",
]);

export type BasketSettingsSchema = (typeof BASKET_SETTINGS_SCHEMAS)[number]["code"];

export interface Indicator {
    id: number;
    name: string;
}
export type BasketStatus = "active" | "retired";
export type BasketVersionStatus = "draft" | "test" | "working" | "off";
export type VersionAvailability = Exclude<BasketVersionStatus, "draft">;
export type VersionView = "active" | "draft" | "off" | "all";

export interface BasketVersionRef {
    versionNo: number;
    name: string;
    status: BasketVersionStatus;
}

export interface NumberConstraints {
    min: number | null;
    max: number | null;
    integer: boolean;
}

export interface TextConstraints {
    minLength: number | null;
    maxLength: number | null;
}

interface BasketParameterBase {
    key: string;
    title: string;
    description: string;
}

export type BasketParameter =
    | (BasketParameterBase & { kind: "number"; constraints: NumberConstraints })
    | (BasketParameterBase & { kind: "text"; constraints: TextConstraints })
    | (BasketParameterBase & { kind: "choice"; options: string[] });

export interface VersionSettings {
    parameters: BasketParameter[];
}

export interface BasketSummary {
    id: number;
    code: string;
    name: string;
    description: string;
    indicatorId: number;
    indicatorName: string;
    settingsSchema: string;
    status: BasketStatus;
    mandatory: boolean;
    versions: BasketVersionRef[];
}

export interface BasketVersionChange {
    id: number;
    comment: string;
    author: string;
    name: string;
    settings: VersionSettings;
    createdAt: string;
}

export interface BasketVersion {
    id: number;
    versionNo: number;
    name: string;
    status: BasketVersionStatus;
    settings: VersionSettings;
    publishedAt: string | null;
    changes: BasketVersionChange[];
}

export interface BasketDetails {
    id: number;
    code: string;
    name: string;
    description: string;
    indicatorId: number;
    indicatorName: string;
    settingsSchema: string;
    status: BasketStatus;
    mandatory: boolean;
    versions: BasketVersion[];
}

export interface BasketDraftInput {
    code: string;
    name: string;
    description: string;
    indicatorId: number;
    settingsSchema: BasketSettingsSchema;
    mandatory: boolean;
}

export interface BasketProfileInput {
    name: string;
    description: string;
    mandatory: boolean;
}

export function parseBasketMandatory(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

export interface BasketVersionDraftInput {
    name: string;
    comment: string;
    settings: VersionSettings;
}

export function settingsSchemaTitle(code: string): string {
    return BASKET_SETTINGS_SCHEMAS.find((item) => item.code === code)?.title ?? code;
}

export function settingsSchemaDescription(code: string): string {
    return BASKET_SETTINGS_SCHEMAS.find((item) => item.code === code)?.description
        ?? "Набор полей этой корзины.";
}

export function basketStatusTitle(status: BasketStatus): string {
    return status === "active" ? "В каталоге" : "Выключена";
}

export function versionStatusTitle(status: BasketVersionStatus): string {
    switch (status) {
        case "draft":
            return "Черновик";
        case "test":
            return "Тестовая";
        case "working":
            return "Рабочая";
        case "off":
            return "Архивная";
    }
}

export function versionStatusComment(from: BasketVersionStatus, to: VersionAvailability): string {
    if (to === "off") {
        return "Переведена в архив и недоступна к новому подключению";
    }
    if (from === "draft") {
        return to === "test" ? "Опубликована как тестовая" : "Опубликована как рабочая";
    }
    if (from === "off") {
        return to === "test" ? "Возвращена из архива как тестовая" : "Возвращена из архива как рабочая";
    }
    return to === "test" ? "Переведена в тестовые" : "Переведена в рабочие";
}

export function parseIndicatorName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const name = value.trim();
    if (name.length === 0 || name.length > INDICATOR_NAME_MAX) {
        return null;
    }
    return name;
}

export function isBasketSettingsSchema(value: string): value is BasketSettingsSchema {
    return BASKET_SETTINGS_SCHEMAS.some((item) => item.code === value);
}

export function isBasketStatus(value: string): value is BasketStatus {
    return value === "active" || value === "retired";
}

export function isBasketVersionStatus(value: string): value is BasketVersionStatus {
    return value === "draft" || value === "test" || value === "working" || value === "off";
}

export function isVersionAvailability(value: string): value is VersionAvailability {
    return value === "test" || value === "working" || value === "off";
}

export function compareVersions(
    left: { status: BasketVersionStatus; versionNo: number },
    right: { status: BasketVersionStatus; versionNo: number }
): number {
    const rank: Record<BasketVersionStatus, number> = { working: 0, test: 1, draft: 2, off: 3 };
    return rank[left.status] - rank[right.status] || right.versionNo - left.versionNo;
}

export function versionMatchesView(status: BasketVersionStatus, view: VersionView): boolean {
    if (view === "all") return true;
    if (view === "active") return status === "test" || status === "working";
    return status === view;
}

export function versionViewTitle(view: VersionView): string {
    switch (view) {
        case "active":
            return "Активные";
        case "draft":
            return "Черновики";
        case "off":
            return "Архивные";
        case "all":
            return "Все";
    }
}

export function parseBasketCode(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const code = value.trim().toLowerCase();
    return BASKET_CODE_PATTERN.test(code) ? code : null;
}

export function parseBasketName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const name = value.trim();
    if (name.length === 0 || name.length > BASKET_NAME_MAX) {
        return null;
    }
    return name;
}

export function parseVersionName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const name = value.trim();
    if (name.length === 0 || name.length > VERSION_NAME_MAX) {
        return null;
    }
    return name;
}

export function parseVersionComment(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const comment = value.trim();
    if (comment.length === 0 || comment.length > VERSION_COMMENT_MAX) {
        return null;
    }
    return comment;
}

export function parseBasketDescription(value: unknown): string | null {
    if (value === undefined || value === null) {
        return "";
    }
    if (typeof value !== "string") {
        return null;
    }
    const description = value.trim();
    if (description.length > BASKET_DESCRIPTION_MAX) {
        return null;
    }
    return description;
}

export function parameterKindTitle(kind: ParameterKind): string {
    return PARAMETER_KINDS.find((item) => item.code === kind)?.title ?? kind;
}

export function parameterConstraintSummary(parameter: BasketParameter): string {
    if (parameter.kind === "choice") {
        return parameter.options.join(", ");
    }
    if (parameter.kind === "text") {
        const parts: string[] = [];
        if (parameter.constraints.minLength !== null) {
            parts.push(`от ${parameter.constraints.minLength} символов`);
        }
        if (parameter.constraints.maxLength !== null) {
            parts.push(`до ${parameter.constraints.maxLength} символов`);
        }
        return parts.length > 0 ? parts.join(", ") : "без ограничений";
    }
    const parts: string[] = [];
    if (parameter.constraints.min !== null) {
        parts.push(`от ${parameter.constraints.min}`);
    }
    if (parameter.constraints.max !== null) {
        parts.push(`до ${parameter.constraints.max}`);
    }
    if (parameter.constraints.integer) {
        parts.push("только целое");
    }
    return parts.length > 0 ? parts.join(", ") : "без ограничений";
}

type ParameterParse = { parameter: BasketParameter } | { error: string };

function readBoundNumber(value: unknown, label: string): { value: number | null } | { error: string } {
    if (value === undefined || value === null || value === "") {
        return { value: null };
    }
    if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1e12) {
        return { error: `${label}: укажите число` };
    }
    return { value };
}

function readLength(value: unknown, label: string): { value: number | null } | { error: string } {
    if (value === undefined || value === null || value === "") {
        return { value: null };
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > PARAMETER_TEXT_LENGTH_MAX) {
        return { error: `${label}: целое число от 0 до ${PARAMETER_TEXT_LENGTH_MAX}` };
    }
    return { value };
}

function parseParameter(item: unknown, usedTitles: Set<string>): ParameterParse {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { error: "Некорректный параметр" };
    }
    const record = item as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (title.length === 0 || title.length > PARAMETER_TITLE_MAX) {
        return { error: "У каждого параметра должно быть название не длиннее 100 символов" };
    }
    const titleKey = title.toLowerCase();
    if (usedTitles.has(titleKey)) {
        return { error: "Названия параметров не должны повторяться" };
    }
    usedTitles.add(titleKey);

    let description = "";
    if (record.description !== undefined && record.description !== null) {
        if (typeof record.description !== "string") {
            return { error: `Описание параметра «${title}» задано неверно` };
        }
        description = record.description.trim();
        if (description.length > PARAMETER_DESCRIPTION_MAX) {
            return { error: `Описание параметра «${title}» длиннее ${PARAMETER_DESCRIPTION_MAX} символов` };
        }
    }

    const rawKind = record.kind;
    const kind: ParameterKind = rawKind === undefined ? "number" : (
        rawKind === "number" || rawKind === "text" || rawKind === "choice" ? rawKind : "number"
    );
    if (rawKind !== undefined && rawKind !== "number" && rawKind !== "text" && rawKind !== "choice") {
        return { error: `У параметра «${title}» неизвестный вид` };
    }

    if (kind === "choice") {
        if (!Array.isArray(record.options)) {
            return { error: `У параметра «${title}» укажите варианты` };
        }
        const options: string[] = [];
        const seen = new Set<string>();
        for (const option of record.options) {
            if (typeof option !== "string") {
                return { error: `Вариант параметра «${title}» задан неверно` };
            }
            const label = option.trim();
            if (label.length === 0) {
                continue;
            }
            if (label.length > PARAMETER_OPTION_MAX) {
                return { error: `Вариант параметра «${title}» длиннее ${PARAMETER_OPTION_MAX} символов` };
            }
            const optionKey = label.toLowerCase();
            if (seen.has(optionKey)) {
                return { error: `Варианты параметра «${title}» не должны повторяться` };
            }
            seen.add(optionKey);
            options.push(label);
        }
        if (options.length < 2 || options.length > PARAMETER_OPTIONS_MAX) {
            return { error: `У параметра «${title}» нужно от 2 до ${PARAMETER_OPTIONS_MAX} вариантов` };
        }
        return { parameter: { key: "", title, description, kind, options } };
    }

    const constraints = record.constraints;
    const constraintRecord = constraints && typeof constraints === "object" && !Array.isArray(constraints)
        ? constraints as Record<string, unknown>
        : {};

    if (kind === "text") {
        const minLength = readLength(constraintRecord.minLength, `Минимум символов у «${title}»`);
        if ("error" in minLength) return minLength;
        const maxLength = readLength(constraintRecord.maxLength, `Максимум символов у «${title}»`);
        if ("error" in maxLength) return maxLength;
        if (minLength.value !== null && maxLength.value !== null && minLength.value > maxLength.value) {
            return { error: `У параметра «${title}» минимум символов больше максимума` };
        }
        return {
            parameter: {
                key: "",
                title,
                description,
                kind,
                constraints: { minLength: minLength.value, maxLength: maxLength.value },
            },
        };
    }

    const min = readBoundNumber(constraintRecord.min, `Минимум у «${title}»`);
    if ("error" in min) return min;
    const max = readBoundNumber(constraintRecord.max, `Максимум у «${title}»`);
    if ("error" in max) return max;
    if (min.value !== null && max.value !== null && min.value > max.value) {
        return { error: `У параметра «${title}» минимум больше максимума` };
    }
    const integer = constraintRecord.integer === undefined ? false : constraintRecord.integer;
    if (typeof integer !== "boolean") {
        return { error: `Ограничение «только целое» у «${title}» задано неверно` };
    }
    return {
        parameter: {
            key: "",
            title,
            description,
            kind: "number",
            constraints: { min: min.value, max: max.value, integer },
        },
    };
}

export function parseVersionParameters(value: unknown): { parameters: BasketParameter[] } | { error: string } {
    if (!Array.isArray(value)) {
        return { error: "Список параметров задан неверно" };
    }
    if (value.length > PARAMETER_LIST_MAX) {
        return { error: `Параметров не больше ${PARAMETER_LIST_MAX}` };
    }

    const usedKeys = new Set<string>();
    const usedTitles = new Set<string>();
    const parameters: BasketParameter[] = [];

    for (const item of value) {
        const parsed = parseParameter(item, usedTitles);
        if ("error" in parsed) {
            return parsed;
        }
        const rawKey = item && typeof item === "object" && typeof (item as { key?: unknown }).key === "string"
            ? (item as { key: string }).key.trim().toLowerCase()
            : "";
        const title = parsed.parameter.title;
        if (!PARAMETER_KEY_PATTERN.test(rawKey)) {
            return { error: `Укажите код параметра «${title}»: латинские буквы, цифры и подчёркивание, с буквы` };
        }
        if (RESERVED_PARAMETER_KEYS.has(rawKey)) {
            return { error: `Код «${rawKey}» зарезервирован для подключения к территории` };
        }
        if (usedKeys.has(rawKey)) {
            return { error: `Код «${rawKey}» уже используется другим параметром` };
        }
        usedKeys.add(rawKey);
        parameters.push({ ...parsed.parameter, key: rawKey });
    }

    return { parameters };
}

export function parametersEqual(left: BasketParameter[], right: BasketParameter[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

export function readVersionSettings(value: unknown): VersionSettings {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { parameters: [] };
    }

    const record = value as { parameters?: unknown; tariff?: unknown };
    if (Array.isArray(record.parameters)) {
        const parsed = parseVersionParameters(record.parameters);
        if ("parameters" in parsed) {
            return { parameters: parsed.parameters };
        }
        return { parameters: [] };
    }

    if (record.tariff !== undefined && record.tariff !== null && record.tariff !== "") {
        return {
            parameters: [{
                key: "tariff",
                title: "Тариф",
                description: "",
                kind: "number",
                constraints: { min: null, max: null, integer: false },
            }],
        };
    }

    return { parameters: [] };
}

export function versionSettingsPayload(settings: VersionSettings): { parameters: BasketParameter[] } {
    return { parameters: settings.parameters };
}
