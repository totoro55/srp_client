export const PERMISSION_CATALOG = [
    {
        code: "access.read",
        group: "Доступ",
        title: "Просмотр настроек",
        description: "Роли, матрица, трансляция и области",
    },
    {
        code: "access.write",
        group: "Доступ",
        title: "Изменение настроек",
        description: "Роли, галочки матрицы, правила трансляции и назначения территорий",
    },
    {
        code: "bonus.any:read",
        group: "Премия",
        title: "Любая премия",
        description: "Сумма и состав премии любого сотрудника",
    },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

export const PERMISSION_CODES: PermissionCode[] = PERMISSION_CATALOG.map((item) => item.code);

export function isPermissionCode(value: string): value is PermissionCode {
    return (PERMISSION_CODES as string[]).includes(value);
}

export function isWritePermission(code: PermissionCode): boolean {
    return code.endsWith(":write");
}

export const SCOPE_KINDS = ["division", "granted", "home_branch", "none"] as const;

export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const SCOPE_KIND_LABELS: Record<ScopeKind, string> = {
    division: "Дивизион",
    granted: "Территория",
    home_branch: "Филиал",
    none: "Без области",
};

export function isScopeKind(value: string): value is ScopeKind {
    return (SCOPE_KINDS as readonly string[]).includes(value);
}
