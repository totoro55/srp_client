export const PERMISSION_CATALOG = [
    {
        code: "app.home:read",
        title: "Главная",
        description: "Просмотр главной панели",
    },
    {
        code: "app.dashboard:read",
        title: "Мониторинг",
        description: "Просмотр страницы мониторинга",
    },
    {
        code: "app.settings:read",
        title: "Настройки",
        description: "Просмотр страницы настроек",
    },
    {
        code: "admin.roles:read",
        title: "Роли: просмотр",
        description: "Просмотр ролей, соответствий LDAP и исключений",
    },
    {
        code: "admin.roles:write",
        title: "Роли: изменение",
        description: "Создание и изменение ролей, соответствий LDAP и исключений",
    },
    {
        code: "admin.matrix:read",
        title: "Матрица: просмотр",
        description: "Просмотр матрицы назначения прав",
    },
    {
        code: "admin.matrix:write",
        title: "Матрица: изменение",
        description: "Назначение и снятие прав у ролей",
    },
    {
        code: "admin.catalog:read",
        title: "Каталог прав",
        description: "Просмотр справочника кодов доступа",
    },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

export const PERMISSION_CODES: PermissionCode[] = PERMISSION_CATALOG.map((item) => item.code);

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL";

export type RouteAccess =
    | { kind: "public" }
    | { kind: "authenticated" }
    | { kind: "superuser" }
    | { kind: "permission"; permission: PermissionCode };

export interface RoutePolicy {
    pattern: string;
    method: HttpMethod;
    access: RouteAccess;
}

export const ROUTE_POLICIES: RoutePolicy[] = [
    { pattern: "/login", method: "ALL", access: { kind: "public" } },
    { pattern: "/forbidden", method: "ALL", access: { kind: "public" } },
    { pattern: "/unauthorized", method: "ALL", access: { kind: "public" } },
    { pattern: "/api/auth/*", method: "ALL", access: { kind: "public" } },
    { pattern: "/api/me/access", method: "GET", access: { kind: "authenticated" } },
    { pattern: "/api/admin/impersonate", method: "ALL", access: { kind: "superuser" } },
    { pattern: "/api/admin/roles", method: "GET", access: { kind: "permission", permission: "admin.roles:read" } },
    { pattern: "/api/admin/roles", method: "ALL", access: { kind: "permission", permission: "admin.roles:write" } },
    { pattern: "/api/admin/available-positions", method: "GET", access: { kind: "permission", permission: "admin.roles:read" } },
    { pattern: "/api/admin/matrix", method: "GET", access: { kind: "permission", permission: "admin.matrix:read" } },
    { pattern: "/api/admin/matrix", method: "ALL", access: { kind: "permission", permission: "admin.matrix:write" } },
    { pattern: "/api/admin/permissions", method: "GET", access: { kind: "permission", permission: "admin.catalog:read" } },
    { pattern: "/", method: "GET", access: { kind: "permission", permission: "app.home:read" } },
    { pattern: "/dashboard", method: "GET", access: { kind: "permission", permission: "app.dashboard:read" } },
    { pattern: "/settings", method: "GET", access: { kind: "permission", permission: "app.settings:read" } },
    { pattern: "/admin/roles", method: "GET", access: { kind: "permission", permission: "admin.roles:read" } },
    { pattern: "/admin/matrix", method: "GET", access: { kind: "permission", permission: "admin.matrix:read" } },
    { pattern: "/admin/permissions", method: "GET", access: { kind: "permission", permission: "admin.catalog:read" } },
];

export function isPermissionCode(value: string): value is PermissionCode {
    return (PERMISSION_CODES as string[]).includes(value);
}
