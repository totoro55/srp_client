export type MotivationKtu = "plus" | "minus";
export type RuleKtu = MotivationKtu | "any";

export interface MotivationRole {
    id: string;
    title: string;
}

export interface MotivationRoleRule {
    id: string;
    title: string;
    ktu: RuleKtu;
    roleId: string | null;
}

export interface MotivationSettings {
    roles: MotivationRole[];
    rules: MotivationRoleRule[];
}

export const STORE_EMPLOYEE_TITLE = "Универсальный сотрудник магазина";
export const ISSUANCE_EMPLOYEE_TITLE = "Сотрудник выдачи магазина";
export const KEEPER_TITLE = "Кладовщик";

export const RULE_KTU_LABELS: Record<RuleKtu, string> = {
    plus: "КТУ+",
    minus: "КТУ−",
    any: "Любой",
};

const SEED: MotivationSettings = {
    roles: [
        { id: "usm", title: "УСМ" },
        { id: "svm", title: "СВМ" },
        { id: "keeper", title: "Кладовщик" },
        { id: "merchandiser", title: "Мерчендайзер" },
    ],
    rules: [
        { id: "issuance", title: ISSUANCE_EMPLOYEE_TITLE, ktu: "any", roleId: "svm" },
        { id: "keeper", title: KEEPER_TITLE, ktu: "any", roleId: "keeper" },
        { id: "store-plus", title: STORE_EMPLOYEE_TITLE, ktu: "plus", roleId: "usm" },
        { id: "store-minus", title: STORE_EMPLOYEE_TITLE, ktu: "minus", roleId: null },
    ],
};

let settings: MotivationSettings = cloneSettings(SEED);
const listeners = new Set<() => void>();

function cloneSettings(value: MotivationSettings): MotivationSettings {
    return {
        roles: value.roles.map((role) => ({ ...role })),
        rules: value.rules.map((rule) => ({ ...rule })),
    };
}

function emit(): void {
    listeners.forEach((listener) => listener());
}

export function getMotivationSettings(): MotivationSettings {
    return settings;
}

export function subscribeMotivationSettings(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function replace(next: MotivationSettings): void {
    settings = next;
    emit();
}

export function automaticRole(title: string, ktu: MotivationKtu, source: MotivationSettings = settings): string | null {
    const needle = title.trim().toLowerCase();
    const rule = source.rules.find((item) => item.title.trim().toLowerCase() === needle && (item.ktu === "any" || item.ktu === ktu));
    return rule?.roleId ?? null;
}

export function roleTitle(roleId: string | null, source: MotivationSettings = settings): string {
    if (!roleId) {
        return "Пусто";
    }
    return source.roles.find((role) => role.id === roleId)?.title ?? roleId;
}

export function addMotivationRole(role: MotivationRole): string | null {
    const id = role.id.trim().toLowerCase();
    const title = role.title.trim();
    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
        return "Код латиницей, со строчной буквы, без пробелов";
    }
    if (!title) {
        return "Укажите название";
    }
    if (settings.roles.some((item) => item.id === id)) {
        return "Роль с таким кодом уже есть";
    }
    replace({ ...settings, roles: [...settings.roles, { id, title }] });
    return null;
}

export function updateMotivationRole(id: string, title: string): string | null {
    const nextTitle = title.trim();
    if (!nextTitle) {
        return "Укажите название";
    }
    if (!settings.roles.some((role) => role.id === id)) {
        return "Роль не найдена";
    }
    replace({
        ...settings,
        roles: settings.roles.map((role) => (role.id === id ? { ...role, title: nextTitle } : role)),
    });
    return null;
}

export function removeMotivationRole(id: string): string | null {
    const used = settings.rules.find((rule) => rule.roleId === id);
    if (used) {
        return `Роль стоит в правиле для должности «${used.title}»`;
    }
    replace({ ...settings, roles: settings.roles.filter((role) => role.id !== id) });
    return null;
}

export function saveMotivationRule(rule: MotivationRoleRule): string | null {
    const title = rule.title.trim();
    if (!title) {
        return "Укажите должность";
    }
    if (rule.roleId && !settings.roles.some((role) => role.id === rule.roleId)) {
        return "Выберите роль из списка";
    }
    const duplicate = settings.rules.some((item) => item.id !== rule.id && item.title.trim().toLowerCase() === title.toLowerCase() && item.ktu === rule.ktu);
    if (duplicate) {
        return "Такое правило уже есть";
    }
    const next = { ...rule, title, roleId: rule.roleId };
    const exists = settings.rules.some((item) => item.id === rule.id);
    replace({
        ...settings,
        rules: exists ? settings.rules.map((item) => (item.id === rule.id ? next : item)) : [...settings.rules, next],
    });
    return null;
}

export function removeMotivationRule(id: string): void {
    replace({ ...settings, rules: settings.rules.filter((rule) => rule.id !== id) });
}

export function moveMotivationRule(id: string, direction: -1 | 1): void {
    const index = settings.rules.findIndex((rule) => rule.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= settings.rules.length) {
        return;
    }
    const rules = [...settings.rules];
    const [rule] = rules.splice(index, 1);
    rules.splice(target, 0, rule);
    replace({ ...settings, rules });
}
