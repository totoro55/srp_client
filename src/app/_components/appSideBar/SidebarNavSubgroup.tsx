'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { isRouteActive, type NavigationSubgroup } from '@/lib/routes-config';

interface SidebarNavSubgroupProps {
    subgroup: NavigationSubgroup;
    pathname: string;
}

export function SidebarNavSubgroup({ subgroup, pathname }: SidebarNavSubgroupProps) {
    const { state, isMobile, setOpenMobile } = useSidebar();
    const Icon = subgroup.icon;
    const active = subgroup.items.some((item) => isRouteActive(pathname, item.href));
    const [open, setOpen] = useState(active);
    const collapsed = !isMobile && state === 'collapsed';

    useEffect(() => {
        if (active) {
            setOpen(true);
        }
    }, [active]);

    if (collapsed) {
        return (
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger
                        render={
                            <SidebarMenuButton tooltip={subgroup.label} isActive={active} />
                        }
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{subgroup.label}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" sideOffset={8} className="min-w-44">
                        {subgroup.items.map((item) => {
                            const ItemIcon = item.icon;
                            const itemActive = isRouteActive(pathname, item.href);
                            return (
                                <DropdownMenuItem
                                    key={item.href}
                                    className={itemActive ? 'bg-accent text-accent-foreground' : undefined}
                                    render={
                                        <Link href={item.href} onClick={() => setOpenMobile(false)}>
                                            <ItemIcon />
                                            {item.name}
                                        </Link>
                                    }
                                />
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        );
    }

    return (
        <SidebarMenuItem>
            <Collapsible open={open} onOpenChange={setOpen} className="w-full">
                <CollapsibleTrigger
                    render={
                        <SidebarMenuButton
                            size={isMobile ? 'lg' : 'default'}
                            className={isMobile ? 'h-12 gap-3 text-base [&_svg]:size-5' : 'gap-3'}
                        />
                    }
                >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{subgroup.label}</span>
                    <ChevronRight className="ml-auto transition-transform group-data-panel-open/menu-button:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenuSub>
                        {subgroup.items.map((item) => {
                            const ItemIcon = item.icon;
                            return (
                                <SidebarMenuSubItem key={item.href}>
                                    <SidebarMenuSubButton
                                        isActive={isRouteActive(pathname, item.href)}
                                        className={isMobile ? 'h-11 text-base' : undefined}
                                        render={
                                            <Link
                                                href={item.href}
                                                className="flex items-center gap-2"
                                                onClick={() => setOpenMobile(false)}
                                            >
                                                <ItemIcon className="h-4 w-4 shrink-0" />
                                                <span>{item.name}</span>
                                            </Link>
                                        }
                                    />
                                </SidebarMenuSubItem>
                            );
                        })}
                    </SidebarMenuSub>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    );
}
