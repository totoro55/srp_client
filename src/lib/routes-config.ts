// src/lib/routes-config.ts
import type { PermissionCode } from "@/lib/permissions";
import {
    LayoutDashboard,
    Settings,
    Grid3X3,
    KeyRound,
    Layers,
    ShieldAlert,
    Folder,
    Home,
} from "lucide-react";

export interface RouteItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
    permission: PermissionCode;
}

export interface NavigationGroup {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    items: RouteItem[];
}

export const APP_NAVIGATION_MAP: NavigationGroup[] = [
    {
        id: 'main',
        label: "Основное меню",
        icon: Folder,
        items: [
            { name: 'Главная панель', href: '/', icon: Home, title: 'Главная панель', permission: 'app.home:read' },
            { name: 'Мониторинг', href: '/dashboard', icon: LayoutDashboard, title: 'Мониторинг', permission: 'app.dashboard:read' },
            { name: 'Настройки', href: '/settings', icon: Settings, title: 'Настройки', permission: 'app.settings:read' },
        ]
    },
    {
        id: 'security',
        label: "Доступы и безопасность",
        icon: ShieldAlert,
        items: [
            {
                name: 'Матрица доступов',
                href: '/admin/matrix',
                icon: Grid3X3,
                title: 'Матрица прав безопасности',
                description: 'Назначение кодов доступа ролям',
                permission: 'admin.matrix:read',
            },
            {
                name: 'Роли и LDAP',
                href: '/admin/roles',
                icon: KeyRound,
                title: 'Управление доступами LDAP',
                description: 'Роли, соответствия должностей AD и исключения',
                permission: 'admin.roles:read',
            },
            {
                name: 'Каталог прав',
                href: '/admin/permissions',
                icon: Layers,
                title: 'Каталог прав доступа',
                description: 'Справочник кодов, которые назначаются ролям в матрице',
                permission: 'admin.catalog:read',
            },
        ]
    }
];

export interface PageHeading {
    title: string;
    description?: string;
}

const EXTRA_PAGE_HEADINGS: Record<string, PageHeading> = {
    "/login": { title: "Авторизация" },
    "/forbidden": { title: "Доступ ограничен" },
};

export function getPageHeading(pathname: string): PageHeading | null {
    const extra = EXTRA_PAGE_HEADINGS[pathname];
    if (extra) {
        return extra;
    }

    for (const group of APP_NAVIGATION_MAP) {
        const item = group.items.find((route) => route.href === pathname);
        if (item) {
            return {
                title: item.title ?? item.name,
                description: item.description,
            };
        }
    }

    return null;
}
