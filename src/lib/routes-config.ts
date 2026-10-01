import type { PermissionCode } from "@/lib/permissions";
import { Grid3X3, KeyRound, MapPinned, Settings, ShieldAlert, Home, Users, ShoppingBasket } from "lucide-react";

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
        id: "motivation",
        label: "Мотивация",
        icon: ShoppingBasket,
        items: [
            {
                name: "Корзины",
                href: "/admin/baskets",
                icon: ShoppingBasket,
                title: "Корзины",
                description: "Каталог схем расчёта и их версии",
                permission: "baskets:read",
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

export function isRouteActive(pathname: string, href: string): boolean {
    if (href === "/") {
        return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function getPageHeading(pathname: string): PageHeading | null {
    const extra = EXTRA_PAGE_HEADINGS[pathname];
    if (extra) {
        return extra;
    }

    let best: RouteItem | null = null;
    for (const group of APP_NAVIGATION_MAP) {
        for (const item of group.items) {
            if (!isRouteActive(pathname, item.href)) {
                continue;
            }
            if (!best || item.href.length > best.href.length) {
                best = item;
            }
        }
    }

    if (!best) {
        return null;
    }

    return {
        title: best.title ?? best.name,
        description: best.description,
    };
}
