// src/components/AppSideBar.tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {SidebarMenuItem, useSidebar} from "@/components/ui/sidebar";
import { APP_NAVIGATION_MAP, NavigationGroup } from '@/lib/routes-config';
import { SidebarUserMenu } from './SidebarUserMenu';
import { SidebarNavItem } from './SidebarNavItem';
import { useImpersonationMask } from "@/hooks/useImpersonationMask";
import { isAdminRole } from "@/lib/roles";
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
    const { impersonatedRole, permissions: maskPermissions } = useImpersonationMask();

    const activeRole = useMemo(() => {
        if (isAdminRole(originalRole) && impersonatedRole) {
            return impersonatedRole;
        }
        return originalRole;
    }, [originalRole, impersonatedRole]);

    const dynamicNavigation = useMemo((): NavigationGroup[] => {
        if (!activeRole) return [];

        if (isAdminRole(activeRole)) return APP_NAVIGATION_MAP;

        const permissions =
            isAdminRole(originalRole) && impersonatedRole
                ? maskPermissions
                : session?.user?.permissions || [];

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
    }, [activeRole, originalRole, impersonatedRole, maskPermissions, session?.user?.permissions]);

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
