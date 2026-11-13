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

export interface ManagerGrantPolicy {
    access: boolean;
    roles: boolean;
    brigades: boolean;
    shared: boolean;
}

export const CLOSED_GRANT_POLICY: ManagerGrantPolicy = {
    access: false,
    roles: false,
    brigades: false,
    shared: false,
};

export type ManagerGrantPolicies = Record<ManagerTitleGroup, ManagerGrantPolicy>;

export function closedGrantPolicies(): ManagerGrantPolicies {
    return {
        manager: { ...CLOSED_GRANT_POLICY },
        deputy: { ...CLOSED_GRANT_POLICY },
        senior: { ...CLOSED_GRANT_POLICY },
    };
}

export interface ManagerAccessPage {
    territory: { uuid: string; name: string; code: string };
    editable: boolean;
    notice: string | null;
    settings: ManagerGrantSettings;
    policies: ManagerGrantPolicies;
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
 * Свой филиал внутри РРС открыт всегда. Остальные отметки выключены,
 * пока их не включат лично или общей выдачей. Личная строка важнее общей выдачи.
 * Свой филиал вне текущей РРС этой выдачей не меняется: там остаются настройки роли.
 */
export function effectiveManagerFlags(
    home: boolean,
    sameTerritory: boolean,
    grants: readonly StoredManagerGrant[],
    roleSettings: ManagerGrantSettings,
    policy: ManagerGrantPolicy,
): ManagerGrantSettings & { access: boolean } {
    if (home && !sameTerritory) {
        return { access: true, ...roleSettings };
    }
    if (!sameTerritory) {
        return EMPTY_FLAGS;
    }
    const access = home || grantFlag(grants, MANAGER_BRANCH_ACCESS, policy.access);
    if (!access) {
        return EMPTY_FLAGS;
    }
    return {
        access: true,
        roles: roleSettings.roles && grantFlag(grants, "branch.roles:write", policy.roles),
        brigades: roleSettings.brigades && grantFlag(grants, "branch.brigades:write", policy.brigades),
        shared: roleSettings.shared && grantFlag(grants, "branch.shared:write", policy.shared),
    };
}

function grantFlag(grants: readonly StoredManagerGrant[], code: string, baseline: boolean): boolean {
    const grant = grants.find((item) => item.code === code);
    return grant ? grant.allowed : baseline;
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
    policy: ManagerGrantPolicy,
    existing: readonly StoredManagerGrant[],
): { rows: SparseManagerGrant[] } | { error: string } {
    if (home && !branch.access) {
        return { error: "Свой филиал остаётся открытым" };
    }
    if (!branch.access) {
        for (const [field] of MANAGER_SETTING_FIELDS) {
            if (branch[field]) {
                return { error: "Настройка чужого филиала включается вместе с доступом" };
            }
        }
    }
    const rows: SparseManagerGrant[] = [];
    if (!home) {
        const accessRow = retainGrant(existing, MANAGER_BRANCH_ACCESS, branch.access, policy.access);
        if (accessRow) {
            rows.push({ ...accessRow, branchId: branch.id });
        }
    }
    if (!branch.access) {
        return { rows };
    }
    for (const [field, code] of MANAGER_SETTING_FIELDS) {
        if (branch[field] && !roleSettings[field]) {
            return { error: "Этой настройки нет у роли управляющего" };
        }
        if (!roleSettings[field]) {
            continue;
        }
        const settingRow = retainGrant(existing, code, branch[field], policy[field]);
        if (settingRow) {
            rows.push({ ...settingRow, branchId: branch.id });
        }
    }
    return { rows };
}

function retainGrant(
    existing: readonly StoredManagerGrant[],
    code: ManagerGrantCode,
    desired: boolean,
    baseline: boolean,
): Omit<SparseManagerGrant, "branchId"> | null {
    const previous = existing.find((item) => item.code === code);
    if (desired === baseline) {
        if (previous && previous.allowed === desired) {
            return { code, allowed: desired };
        }
        return null;
    }
    return { code, allowed: desired };
}
