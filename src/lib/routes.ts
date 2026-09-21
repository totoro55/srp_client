export const ROLE_PERMISSIONS = {
    admin: ['/dashboard','/filial', "/users", "/api/users"],
    moderator: ['/main',],
    user: ['/filial'],
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;

export const PUBLIC_ROUTES = ['/login', "/"];