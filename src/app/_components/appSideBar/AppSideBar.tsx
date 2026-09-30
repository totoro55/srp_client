// src/components/AppSideBar.tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {SidebarMenuItem, useSidebar} from "@/components/ui/sidebar";
import { APP_NAVIGATION_MAP, NavigationGroup } from '@/lib/routes-config';
import { SidebarUserMenu } from './SidebarUserMenu';
import { SidebarNavItem } from './SidebarNavItem';
import { useAccess } from "@/hooks/useAccess";
import {
    Sidebar,
    SidebarContent,
    SidebarMenu,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarFooter
} from "@/components/ui/sidebar";

export function AppSideBar() {
    const pathname = usePathname();
    const { open } = useSidebar();
    const access = useAccess();

    const dynamicNavigation = useMemo((): NavigationGroup[] => {
        return APP_NAVIGATION_MAP.map((group) => {
            const visibleItems = group.items.filter((item) => !item.permission || access.has(item.permission));
            return {
                id: group.id,
                label: group.label,
                icon: group.icon,
                items: visibleItems,
            };
        }).filter((group) => group.items.length > 0);
    }, [access]);

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
