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

const ROLE_ID = /^[a-z][a-z0-9-]{0,39}$/;
const RULE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export type MotivationDraft =
    | { ok: true; settings: MotivationSettings }
    | { ok: false; error: string };

export function automaticRole(title: string, ktu: MotivationKtu | null, source: MotivationSettings): string | null {
    const needle = title.trim().toLowerCase();
    const mark = ktu === "plus" ? "plus" : "minus";
    const rule = source.rules.find((item) => item.title.trim().toLowerCase() === needle && (item.ktu === "any" || item.ktu === mark));
    return rule?.roleId ?? null;
}

export function roleTitle(roleId: string | null, source: MotivationSettings): string {
    if (!roleId) {
        return "Пусто";
    }
    return source.roles.find((role) => role.id === roleId)?.title ?? roleId;
}

export function readMotivationDocument(value: unknown): MotivationSettings | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const body = value as { roles?: unknown; rules?: unknown };
    if (!Array.isArray(body.roles) || !Array.isArray(body.rules)) {
        return null;
    }
    const roles: MotivationRole[] = [];
    for (const item of body.roles) {
        if (!item || typeof item !== "object") {
            return null;
        }
        const role = item as { id?: unknown; title?: unknown };
        if (typeof role.id !== "string" || typeof role.title !== "string") {
            return null;
        }
        roles.push({ id: role.id.trim().toLowerCase(), title: role.title.trim() });
    }
    const rules: MotivationRoleRule[] = [];
    for (const item of body.rules) {
        if (!item || typeof item !== "object") {
            return null;
        }
        const rule = item as { id?: unknown; title?: unknown; ktu?: unknown; roleId?: unknown };
        if (typeof rule.id !== "string" || typeof rule.title !== "string") {
            return null;
        }
        if (rule.ktu !== "plus" && rule.ktu !== "minus" && rule.ktu !== "any") {
            return null;
        }
        if (rule.roleId !== null && typeof rule.roleId !== "string") {
            return null;
        }
        rules.push({
            id: rule.id.trim().toLowerCase(),
            title: rule.title.trim(),
            ktu: rule.ktu,
            roleId: rule.roleId,
        });
    }
    return { roles, rules };
}

export function motivationSettingsError(settings: MotivationSettings): string | null {
    if (settings.roles.length > 100 || settings.rules.length > 200) {
        return "Слишком много записей";
    }
    const roleIds = new Set<string>();
    for (const role of settings.roles) {
        if (!ROLE_ID.test(role.id)) {
            return "Код латиницей, со строчной буквы, без пробелов";
        }
        if (!role.title || role.title.length > 120) {
            return "Укажите название";
        }
        if (roleIds.has(role.id)) {
            return "Роль с таким кодом уже есть";
        }
        roleIds.add(role.id);
    }
    const ruleIds = new Set<string>();
    const pairs = new Set<string>();
    for (const rule of settings.rules) {
        if (!RULE_ID.test(rule.id) || ruleIds.has(rule.id)) {
            return "Некорректное правило";
        }
        ruleIds.add(rule.id);
        if (!rule.title || rule.title.length > 200) {
            return "Укажите должность";
        }
        if (rule.ktu !== "plus" && rule.ktu !== "minus" && rule.ktu !== "any") {
            return "Укажите КТУ";
        }
        if (rule.roleId !== null && !roleIds.has(rule.roleId)) {
            return "Выберите роль из списка";
        }
        const pair = `${rule.title.toLowerCase()}|${rule.ktu}`;
        if (pairs.has(pair)) {
            return "Такое правило уже есть";
        }
        pairs.add(pair);
    }
    return null;
}

export function draftAddRole(settings: MotivationSettings, role: MotivationRole): MotivationDraft {
    const next = {
        ...settings,
        roles: [...settings.roles, { id: role.id.trim().toLowerCase(), title: role.title.trim() }],
    };
    const error = motivationSettingsError(next);
    return error ? { ok: false, error } : { ok: true, settings: next };
}

export function draftUpdateRole(settings: MotivationSettings, id: string, title: string): MotivationDraft {
    if (!settings.roles.some((role) => role.id === id)) {
        return { ok: false, error: "Роль не найдена" };
    }
    const next = {
        ...settings,
        roles: settings.roles.map((role) => (role.id === id ? { ...role, title: title.trim() } : role)),
    };
    const error = motivationSettingsError(next);
    return error ? { ok: false, error } : { ok: true, settings: next };
}

export function draftRemoveRole(settings: MotivationSettings, id: string): MotivationDraft {
    const used = settings.rules.find((rule) => rule.roleId === id);
    if (used) {
        return { ok: false, error: `Роль стоит в правиле для должности «${used.title}»` };
    }
    return {
        ok: true,
        settings: { ...settings, roles: settings.roles.filter((role) => role.id !== id) },
    };
}

export function draftSaveRule(settings: MotivationSettings, rule: MotivationRoleRule): MotivationDraft {
    const nextRule = { ...rule, id: rule.id.trim().toLowerCase(), title: rule.title.trim() };
    const exists = settings.rules.some((item) => item.id === nextRule.id);
    const next = {
        ...settings,
        rules: exists
            ? settings.rules.map((item) => (item.id === nextRule.id ? nextRule : item))
            : [...settings.rules, nextRule],
    };
    const error = motivationSettingsError(next);
    return error ? { ok: false, error } : { ok: true, settings: next };
}

export function draftRemoveRule(settings: MotivationSettings, id: string): MotivationSettings {
    return { ...settings, rules: settings.rules.filter((rule) => rule.id !== id) };
}

export function draftMoveRule(settings: MotivationSettings, id: string, direction: -1 | 1): MotivationSettings | null {
    const index = settings.rules.findIndex((rule) => rule.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= settings.rules.length) {
        return null;
    }
    const rules = [...settings.rules];
    const [rule] = rules.splice(index, 1);
    if (!rule) {
        return null;
    }
    rules.splice(target, 0, rule);
    return { ...settings, rules };
}
