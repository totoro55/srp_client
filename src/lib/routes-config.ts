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
            { name: 'Главная панель', href: '/', icon: Home },
            { name: 'Мониторинг', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Настройки', href: '/settings', icon: Settings },
        ]
    },
    {
        id: 'security',
        label: "Доступы и безопасность",
        icon: ShieldAlert,
        items: [
            { name: 'Матрица доступов', href: '/admin/matrix', icon: Grid3X3 },
            { name: 'Роли и LDAP', href: '/admin/roles', icon: KeyRound },
            { name: 'Защищаемые роуты', href: '/admin/permissions', icon: Layers },
        ]
    }
];
