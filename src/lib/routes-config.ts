import type { PermissionCode } from "@/lib/permissions";
import { Grid3X3, KeyRound, MapPinned, Settings, ShieldAlert, Home, Users } from "lucide-react";

export interface RouteItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
    permission?: PermissionCode;
}

export interface NavigationGroup {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    items: RouteItem[];
}

export const APP_NAVIGATION_MAP: NavigationGroup[] = [
    {
        id: "main",
        label: "Основное меню",
        items: [
            { name: "Главная", href: "/", icon: Home, title: "Главная" },
        ],
    },
    {
        id: "security",
        label: "Доступ",
        icon: ShieldAlert,
        items: [
            {
                name: "Роли",
                href: "/admin/roles",
                icon: Users,
                title: "Роли",
                description: "Создание ролей и вид их области",
                permission: "access.read",
            },
            {
                name: "Матрица",
                href: "/admin/matrix",
                icon: Grid3X3,
                title: "Матрица прав",
                description: "Какие права есть у роли",
                permission: "access.read",
            },
            {
                name: "Трансляция",
                href: "/admin/rules",
                icon: KeyRound,
                title: "Трансляция ролей",
                description: "Логин или должность определяют роль",
                permission: "access.read",
            },
            {
                name: "Области",
                href: "/admin/scopes",
                icon: MapPinned,
                title: "Области",
                description: "Назначение территорий из справочника",
                permission: "access.read",
            },
        ],
    },
    {
        id: "application",
        label: "Приложение",
        icon: Settings,
        items: [
            {
                name: "Настройки",
                href: "/admin/settings",
                icon: Settings,
                title: "Настройки",
                description: "Обслуживание, объявления и просмотр ролей",
                permission: "settings:read",
            },
        ],
    },
];

export interface PageHeading {
    title: string;
    description?: string;
}

const EXTRA_PAGE_HEADINGS: Record<string, PageHeading> = {
    "/login": { title: "Авторизация" },
    "/forbidden": { title: "Доступ ограничен" },
    "/maintenance": { title: "Обслуживание" },
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
