// src/components/AppSideBar.tsx
'use client';

import { useMemo, useState } from 'react'; // Добавили useState
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {SidebarMenuItem, useSidebar} from "@/components/ui/sidebar";
import { APP_NAVIGATION_MAP, NavigationGroup } from '@/lib/routes-config';
import { SidebarUserMenu } from './SidebarUserMenu';
import { SidebarNavItem } from './SidebarNavItem';
import {
    Sidebar,
    SidebarContent,
    SidebarMenu,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarFooter
} from "@/components/ui/sidebar";

function isLinkVisible(href: string, userPermissions: { path: string; method: string }[]): boolean {
    return userPermissions.some((perm) => {
        if (perm.method !== 'ALL' && perm.method.toUpperCase() !== 'GET') return false;

        const regexPattern = perm.path
            .replace(/([.+?^\${}()|[\]\\])/g, '\\$1')
            .replace(/\*/g, '.*');

        const routeRegex = new RegExp(`^${regexPattern}$`, 'i');
        return routeRegex.test(href) || routeRegex.test(href + '/');
    });
}

export function AppSideBar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const { open } = useSidebar();

    const originalRole = session?.user?.role;

    const [impersonatedRole] = useState<string | null>(() => {
        if (typeof document === 'undefined') return null;
        const cookies = document.cookie.split('; ');
        const maskCookie = cookies.find(row => row.startsWith('impersonated_role='));
        // maskCookie.split('=')[1] вернет чистую строку, например "GUEST"
        return maskCookie ? maskCookie.split('=')[1] : null;
    });

    const activeRole = useMemo(() => {
        if (originalRole === 'ADMIN' && impersonatedRole) {
            return impersonatedRole;
        }
        return originalRole;
    }, [originalRole, impersonatedRole]);

    // 2. ДИНАМИЧЕСКАЯ ФИЛЬТРАЦИЯ МАРШРУТОВ САЙДБАРА
    const dynamicNavigation = useMemo((): NavigationGroup[] => {
        if (!activeRole) return [];

        // Если активная роль — ADMIN (вы не в режиме теста), показываем абсолютно ВСЁ
        if (activeRole === 'ADMIN') return APP_NAVIGATION_MAP;

        // 🔥 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ ДЛЯ РЕЖИМА ТЕСТИРОВАНИЯ ФРОНТЕНДА:
        // Если оригинальный админ включил маску (например, GUEST), мы ЗАПРЕЩАЕМ сайдбару
        // использовать оригинальный админский wildcard '*', иначе меню не скроется.
        let permissions = session?.user?.permissions || [];

        if (originalRole === 'ADMIN' && impersonatedRole) {
            if (activeRole === 'GUEST') {
                // Для теста роли GUEST принудительно оставляем доступ только к главной странице
                permissions = [{ path: '/', method: 'GET' }];
            } else {
                // Для любой другой тестируемой роли временно очищаем массив на фронтенде,
                // чтобы сайдбар скрыл защищенные ИБ-разделы
                permissions = [];
            }
        }

        // Фильтруем карту маршрутов на основе вычисленного массива прав permissions
        return APP_NAVIGATION_MAP.map((group) => {
            const visibleItems = group.items.filter((item) =>
                isLinkVisible(item.href, permissions)
            );

            return {
                id: group.id,
                label: group.label,
                icon: group.icon,
                items: visibleItems,
            };
        }).filter(group => group.items.length > 0);
    }, [activeRole, originalRole, impersonatedRole, session?.user?.permissions]);

    return (
        <Sidebar variant="sidebar" collapsible="icon">
            <SidebarContent>
                {dynamicNavigation.map((group) => {
                    const GroupIcon = group.icon;

                    return (
                        <SidebarGroup key={group.id} className="animate-in fade-in duration-200">
                            <SidebarGroupLabel className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground select-none">
                                {GroupIcon && <GroupIcon className="w-3.5 h-3.5 shrink-0 text-primary" />}
                                <span>{group.label}</span>
                            </SidebarGroupLabel>

                            <SidebarMenu>
                                {group.items.map((item) => (
                                    <SidebarNavItem
                                        key={item.href}
                                        item={item}
                                        isActive={pathname === item.href}
                                    />
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    );
                })}
            </SidebarContent>

            <SidebarFooter className="border-t p-2 bg-muted/20">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarUserMenu isOpen={open} />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
