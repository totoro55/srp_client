'use client';

import Link from 'next/link';
import {
    SidebarMenuItem,
    SidebarMenuButton,
    useSidebar
} from "@/components/ui/sidebar";
import { RouteItem } from '@/lib/routes-config';

interface SidebarNavItemProps {
    item: RouteItem;
    isActive: boolean;
}

export function SidebarNavItem({ item, isActive }: SidebarNavItemProps) {
    const Icon = item.icon;
    const { isMobile, setOpenMobile } = useSidebar();

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                size={isMobile ? "lg" : "default"}
                className={isMobile ? "h-12 text-base [&_svg]:size-5" : undefined}
                render={
                    <Link
                        href={item.href}
                        className="flex items-center gap-3"
                        onClick={() => setOpenMobile(false)}
                    >
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
