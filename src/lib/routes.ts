export const ROLE_PERMISSIONS = {
    admin: ['/',],
    moderator: ['/main',],
    user: ['/dashboard'],
} as const;

export type Role = keyof typeof ROLE_PERMISSIONS;

export const PUBLIC_ROUTES = ['/login', "/"];