import type { PermissionCode } from "@/lib/permissions";
import { Grid3X3, KeyRound, List, MapPinned, Settings, ShieldAlert, ShieldX, Home, Users, UserRound, ShoppingBasket, Building2, SlidersHorizontal, Newspaper, BookOpen, MessageSquareText, FileText } from "lucide-react";

export interface RouteItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
    permission?: PermissionCode;
    permissionAny?: PermissionCode[];
}

export interface NavigationSubgroup {
    kind: "subgroup";
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    items: RouteItem[];
}

export type NavigationEntry = RouteItem | NavigationSubgroup;

export function isNavigationSubgroup(entry: NavigationEntry): entry is NavigationSubgroup {
    return "kind" in entry && entry.kind === "subgroup";
}

function routeVisible(item: RouteItem, can: (permission: PermissionCode) => boolean): boolean {
    if (item.permissionAny && item.permissionAny.length > 0) {
        return item.permissionAny.some((permission) => can(permission));
    }
    return !item.permission || can(item.permission);
}

export interface NavigationGroup {
    id: string;
    label: string;
    items: NavigationEntry[];
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
        id: "workspace",
        label: "Приложение",
        items: [
            { name: "Новости", href: "/news", icon: Newspaper, title: "Новости", description: "Сообщения для выбранных ролей" },
            { name: "База знаний", href: "/wiki", icon: BookOpen, title: "База знаний", description: "Описания работы и версии корзин" },
            { name: "Обратная связь", href: "/feedback", icon: MessageSquareText, title: "Обратная связь", description: "Обращения и ответы поддержки" },
        ],
    },
    {
        id: "rrs",
        label: "Настройки мотивации",
        items: [
            {
                name: "Настройки РРС",
                href: "/rrs",
                icon: Building2,
                title: "Настройки РРС",
                description: "Карточки настроек территорий",
                permission: "baskets:connect",
            },
        ],
    },
    {
        id: "baskets",
        label: "Корзины мотивации",
        items: [
            {
                name: "Настройка корзин",
                href: "/admin/baskets",
                icon: ShoppingBasket,
                title: "Настройка корзин",
                description: "Каталог схем расчёта и их версии",
                permission: "baskets:read",
            },
            {
                name: "Алгоритмы тарифов",
                href: "/admin/tariff-algorithms",
                icon: SlidersHorizontal,
                title: "Алгоритмы тарифов",
                description: "Расчёт по категориям и по изделиям",
                permission: "tariffs:read",
            },
        ],
    },
    {
        id: "administration",
        label: "Администрирование",
        items: [
            {
                name: "Настройки",
                href: "/admin/settings",
                icon: Settings,
                title: "Настройки",
                description: "Обслуживание, объявления и просмотр ролей",
                permission: "settings:read",
            },
            {
                name: "Техническая документация",
                href: "/admin/docs",
                icon: FileText,
                title: "Техническая документация",
                description: "Таблицы, маршруты, настройки и контракт расчёта",
                permissionAny: ["settings:read", "access.read"],
            },
            {
                kind: "subgroup",
                id: "access",
                label: "Права",
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
                kind: "subgroup",
                id: "users",
                label: "Пользователи",
                icon: UserRound,
                items: [
                    {
                        name: "Список",
                        href: "/admin/users",
                        icon: List,
                        title: "Пользователи",
                        description: "Кто входил и с какого адреса",
                        permission: "access.read",
                    },
                    {
                        name: "Неуспешные входы",
                        href: "/admin/users/failures",
                        icon: ShieldX,
                        title: "Неуспешные входы",
                        description: "Отказы при проверке пароля",
                        permission: "access.read",
                    },
                ],
            },
        ],
    },
];

export function visibleNavigation(can: (permission: PermissionCode) => boolean): NavigationGroup[] {
    return APP_NAVIGATION_MAP.flatMap((group) => {
        const items = group.items.flatMap((entry): NavigationEntry[] => {
            if (isNavigationSubgroup(entry)) {
                const visibleItems = entry.items.filter((item) => routeVisible(item, can));
                return visibleItems.length > 0 ? [{ ...entry, items: visibleItems }] : [];
            }
            return routeVisible(entry, can) ? [entry] : [];
        });
        return items.length > 0 ? [{ ...group, items }] : [];
    });
}

function routesIn(group: NavigationGroup): RouteItem[] {
    return group.items.flatMap((entry) => (isNavigationSubgroup(entry) ? entry.items : [entry]));
}

export interface PageHeading {
    title: string;
    description?: string;
}

const EXTRA_PAGE_HEADINGS: Record<string, PageHeading> = {
    "/login": { title: "Авторизация" },
    "/forbidden": { title: "Доступ ограничен" },
    "/maintenance": { title: "Обслуживание" },
    "/roadmap": { title: "Дорожная карта", description: "Что уже сделано и что дальше" },
};

export function isRouteActive(pathname: string, href: string): boolean {
    const matches = navigationHrefs().filter((itemHref) => hrefMatches(pathname, itemHref));
    if (matches.length === 0) {
        return false;
    }
    const best = matches.reduce((longest, itemHref) => (itemHref.length > longest.length ? itemHref : longest));
    return best === href;
}

function hrefMatches(pathname: string, href: string): boolean {
    if (href === "/") {
        return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
}

function navigationHrefs(): string[] {
    return APP_NAVIGATION_MAP.flatMap((group) => routesIn(group).map((item) => item.href));
}

export function getPageHeading(pathname: string): PageHeading | null {
    const extra = EXTRA_PAGE_HEADINGS[pathname];
    if (extra) {
        return extra;
    }

    let best: RouteItem | null = null;
    for (const group of APP_NAVIGATION_MAP) {
        for (const item of routesIn(group)) {
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
