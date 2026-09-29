// src/lib/routes-config.ts
import {
    LayoutDashboard,
    Settings,
    Grid3X3,
    KeyRound,
    Layers,
    ShieldAlert, // Иконка для ИБ панели
    Folder, Home      // Иконка для основного меню (по желанию, можно оставить null)
} from 'lucide-react';

export interface RouteItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
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
            { name: 'Главная панель', href: '/', icon: Home, title: 'Главная панель' },
            { name: 'Мониторинг', href: '/dashboard', icon: LayoutDashboard, title: 'Мониторинг' },
            { name: 'Настройки', href: '/settings', icon: Settings, title: 'Настройки' },
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
                description: 'Динамическое разграничение ролевых политик (RBAC)',
            },
            {
                name: 'Роли и LDAP',
                href: '/admin/roles',
                icon: KeyRound,
                title: 'Управление доступами LDAP',
                description: 'Роли, соответствия должностей AD и исключения',
            },
            {
                name: 'Защищаемые роуты',
                href: '/admin/permissions',
                icon: Layers,
                title: 'Управление роутами безопасности',
                description: 'Каталог защищаемых эндпоинтов и страниц системы',
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
