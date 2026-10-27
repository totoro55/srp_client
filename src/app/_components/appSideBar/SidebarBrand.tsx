'use client';

import Link from 'next/link';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

const BRAND_NAME = 'Система расчета премии';

export function SidebarBrand() {
    const { setOpenMobile } = useSidebar();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    size="lg"
                    className="h-10! w-full items-center gap-0 overflow-hidden rounded-lg bg-transparent p-0! text-sidebar-foreground hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground data-active:bg-transparent data-active:text-sidebar-foreground group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-0!"
                    render={
                        <Link href="/" onClick={() => setOpenMobile(false)}>
                            <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-primary bg-transparent text-sm font-extrabold leading-none tracking-tight text-primary transition-[background-color,border-color,color] duration-300 ease-out group-data-[collapsible=icon]:border-primary group-data-[collapsible=icon]:bg-primary group-data-[collapsible=icon]:text-primary-foreground motion-reduce:transition-none">
                                СРП
                            </span>
                            <span className="min-w-0 overflow-hidden">
                                <span className="block w-max pl-2 text-sm font-medium leading-none whitespace-nowrap text-sidebar-foreground transition-[translate] duration-300 ease-out group-data-[collapsible=icon]:-translate-x-full motion-reduce:transition-none">
                                    {BRAND_NAME}
                                </span>
                            </span>
                        </Link>
                    }
                />
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
