// src/components/AppSideBar.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import {SidebarMenuItem, useSidebar} from "@/components/ui/sidebar";
import { isNavigationSubgroup, isRouteActive, visibleNavigation } from '@/lib/routes-config';
import { SidebarUserMenu } from './SidebarUserMenu';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarNavSubgroup } from './SidebarNavSubgroup';
import { useAccess } from "@/hooks/useAccess";
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarMenu,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarFooter
} from "@/components/ui/sidebar";
import { SidebarBrand } from "./SidebarBrand";

export function AppSideBar() {
    const pathname = usePathname();
    const { open, isMobile, setOpenMobile } = useSidebar();
    const access = useAccess();

    useEffect(() => {
        setOpenMobile(false);
    }, [pathname, setOpenMobile]);

    const dynamicNavigation = useMemo(() => {
        const visible = visibleNavigation((permission) => access.has(permission));
        return isMobile ? visible : visible.filter((group) => group.id !== "main");
    }, [access, isMobile]);

    return (
        <Sidebar variant="sidebar" collapsible="icon">
            {isMobile && (
                <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            )}
            {!isMobile && (
                <SidebarHeader className="h-16 justify-center gap-0 p-3">
                    <SidebarBrand />
                </SidebarHeader>
            )}
            {isMobile && (
                <div className="shrink-0 border-b px-4 pt-2 pb-3">
                    <SidebarUserMenu isOpen />
                </div>
            )}
            <SidebarContent className="gap-3">
                {dynamicNavigation.map((group) => {
                    return (
                        <SidebarGroup key={group.id} className="animate-in fade-in px-3 py-0 duration-200">
                            {!(isMobile && group.id === "main") && (
                                <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground select-none">
                                    {group.label}
                                </SidebarGroupLabel>
                            )}

                            <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                                {group.items.map((entry) => (
                                    isNavigationSubgroup(entry) ? (
                                        <SidebarNavSubgroup key={entry.id} subgroup={entry} pathname={pathname} />
                                    ) : (
                                        <SidebarNavItem
                                            key={entry.href}
                                            item={entry}
                                            isActive={isRouteActive(pathname, entry.href)}
                                        />
                                    )
                                ))}
                            </SidebarMenu>
                        </SidebarGroup>
                    );
                })}
            </SidebarContent>

            {!isMobile && (
                <SidebarFooter className="border-t bg-muted/20 p-3">
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarUserMenu isOpen={open} />
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarFooter>
            )}
        </Sidebar>
    );
}
