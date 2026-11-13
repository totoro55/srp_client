import { BRANCH_SETTINGS_PERMISSIONS } from "@/lib/permissions";

export const MANAGER_BRANCH_ACCESS = "branch.access";

export const MANAGER_SETTING_FIELDS = [
    ["roles", "branch.roles:write"],
    ["brigades", "branch.brigades:write"],
    ["shared", "branch.shared:write"],
] as const;

export type ManagerSettingField = (typeof MANAGER_SETTING_FIELDS)[number][0];

export type ManagerGrantCode = typeof MANAGER_BRANCH_ACCESS | (typeof BRANCH_SETTINGS_PERMISSIONS)[number];

export interface ManagerGrantSettings {
    roles: boolean;
    brigades: boolean;
    shared: boolean;
}

export interface ManagerAccessBranch {
    id: string;
    name: string;
    code: string;
    home: boolean;
    access: boolean;
    roles: boolean;
    brigades: boolean;
    shared: boolean;
}

export type ManagerTitleGroup = "manager" | "deputy" | "senior";

export const TITLE_FILTERS = [
    { id: "manager", label: "Управляющий" },
    { id: "deputy", label: "Зам. управляющего" },
    { id: "senior", label: "Старший продавец" },
] as const satisfies readonly { id: ManagerTitleGroup; label: string }[];

export const DEFAULT_TITLE_FILTER: Record<ManagerTitleGroup, boolean> = {
    manager: true,
    deputy: false,
    senior: false,
};

export function managerTitleGroup(title: string): ManagerTitleGroup | null {
    const value = title.trim().toLowerCase().replaceAll("ё", "е");
    if (value.startsWith("зам. управляющего магазина") || value.startsWith("заместитель управляющего магазина")) {
        return "deputy";
    }
    if (value.startsWith("старший продавец")) {
        return "senior";
    }
    if (value.startsWith("управляющий маг.") || value.startsWith("управляющий филиала магазин-склад")) {
        return "manager";
    }
    return null;
}

export function receivesManagerGrants(roleCode: string | null | undefined, title: string): boolean {
    if (roleCode === "store-manager") {
        return true;
    }
    return roleCode === "linear" && managerTitleGroup(title) === "senior";
}

export interface ManagerAccessPerson {
    id: string;
    name: string;
    title: string;
    group: ManagerTitleGroup;
    branchName: string | null;
    branches: ManagerAccessBranch[];
}

export interface ManagerAccessPage {
    territory: { uuid: string; name: string; code: string };
    editable: boolean;
    notice: string | null;
    settings: ManagerGrantSettings;
    managers: ManagerAccessPerson[];
}

export interface StoredManagerGrant {
    code: string;
    allowed: boolean;
}

const EMPTY_FLAGS: ManagerGrantSettings & { access: boolean } = {
    access: false,
    roles: false,
    brigades: false,
    shared: false,
};

/**
 * Свой филиал внутри РРС: доступ есть, настройка роли действует, пока нет строки с ложью.
 * Чужой филиал этой РРС: доступ и каждая настройка включаются отдельной строкой с истиной.
 * Филиал вне текущей РРС управляющего настройками этой РРС не перекрывается.
 */
export function effectiveManagerFlags(
    home: boolean,
    sameTerritory: boolean,
    grants: readonly StoredManagerGrant[],
    roleSettings: ManagerGrantSettings,
): ManagerGrantSettings & { access: boolean } {
    const denied = (code: string) => grants.some((grant) => grant.code === code && !grant.allowed);
    const allowed = (code: string) => grants.some((grant) => grant.code === code && grant.allowed);
    if (home && !sameTerritory) {
        return { access: true, ...roleSettings };
    }
    if (home) {
        return {
            access: true,
            roles: roleSettings.roles && !denied("branch.roles:write"),
            brigades: roleSettings.brigades && !denied("branch.brigades:write"),
            shared: roleSettings.shared && !denied("branch.shared:write"),
        };
    }
    if (!sameTerritory || !allowed(MANAGER_BRANCH_ACCESS)) {
        return EMPTY_FLAGS;
    }
    return {
        access: true,
        roles: roleSettings.roles && allowed("branch.roles:write"),
        brigades: roleSettings.brigades && allowed("branch.brigades:write"),
        shared: roleSettings.shared && allowed("branch.shared:write"),
    };
}

export interface ManagerGrantDraft {
    id: string;
    access: boolean;
    roles: boolean;
    brigades: boolean;
    shared: boolean;
}

export interface SparseManagerGrant {
    branchId: string;
    code: ManagerGrantCode;
    allowed: boolean;
}

export function sparseManagerGrants(
    branch: ManagerGrantDraft,
    home: boolean,
    roleSettings: ManagerGrantSettings,
): { rows: SparseManagerGrant[] } | { error: string } {
    if (home) {
        if (!branch.access) {
            return { error: "Свой филиал остаётся открытым" };
        }
        const rows: SparseManagerGrant[] = [];
        for (const [field, code] of MANAGER_SETTING_FIELDS) {
            if (branch[field] && !roleSettings[field]) {
                return { error: "Этой настройки нет у роли управляющего" };
            }
            if (!branch[field] && roleSettings[field]) {
                rows.push({ branchId: branch.id, code, allowed: false });
            }
        }
        return { rows };
    }
    if (!branch.access) {
        for (const [field] of MANAGER_SETTING_FIELDS) {
            if (branch[field]) {
                return { error: "Настройка чужого филиала включается вместе с доступом" };
            }
        }
        return { rows: [] };
    }
    const rows: SparseManagerGrant[] = [{ branchId: branch.id, code: MANAGER_BRANCH_ACCESS, allowed: true }];
    for (const [field, code] of MANAGER_SETTING_FIELDS) {
        if (branch[field] && !roleSettings[field]) {
            return { error: "Этой настройки нет у роли управляющего" };
        }
        if (branch[field]) {
            rows.push({ branchId: branch.id, code, allowed: true });
        }
    }
    return { rows };
}
