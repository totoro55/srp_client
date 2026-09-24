'use client';

import Link from 'next/link';
import {
    SidebarMenuItem,
    SidebarMenuButton
} from "@/components/ui/sidebar";
import { RouteItem } from '@/lib/routes-config';

interface SidebarNavItemProps {
    item: RouteItem;
    isActive: boolean;
}

export function SidebarNavItem({ item, isActive }: SidebarNavItemProps) {
    const Icon = item.icon;

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                render={
                    <Link href={item.href} className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.name}</span>
                    </Link>
                }
                isActive={isActive}
                tooltip={item.name}
            />
        </SidebarMenuItem>
    );
}
