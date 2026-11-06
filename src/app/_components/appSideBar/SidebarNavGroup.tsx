'use client';

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
} from '@/components/ui/sidebar';
import {
    isNavigationSubgroup,
    isRouteActive,
    type NavigationGroup,
} from '@/lib/routes-config';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarNavSubgroup } from './SidebarNavSubgroup';

interface SidebarNavGroupProps {
    group: NavigationGroup;
    pathname: string;
    showLabel: boolean;
}

export function SidebarNavGroup({ group, pathname, showLabel }: SidebarNavGroupProps) {
    return (
        <SidebarGroup className="animate-in fade-in px-3 py-0 duration-200">
            {showLabel ? (
                <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground select-none">
                    {group.label}
                </SidebarGroupLabel>
            ) : null}
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
}
