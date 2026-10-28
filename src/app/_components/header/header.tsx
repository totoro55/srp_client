'use client'

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { getPageHeading } from "@/lib/routes-config";
import { useAccess } from "@/hooks/useAccess";
import { Menu, X } from "lucide-react";
import { NotificationBell } from "@/app/_components/header/NotificationBell";
import { PageHeadingTrail, usePageHeadingTrail } from "@/app/_components/header/page-heading";

export default function Header() {
    const pathname = usePathname();
    const heading = getPageHeading(pathname);
    const trail = usePageHeadingTrail();
    const access = useAccess();
    const { openMobile, toggleSidebar } = useSidebar();
    const identity = access.roleName ? `${access.roleName} · ${access.scopeLabel}` : access.scopeLabel;

    return (
        <>
        <header className="flex h-16 w-full min-w-0 shrink-0 flex-row items-center justify-start border-b bg-background px-3">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 md:hidden"
                aria-label="Открыть меню"
                onClick={toggleSidebar}
            >
                <Menu />
            </Button>
            <SidebarTrigger aria-label="Открыть меню" className="hidden shrink-0 md:inline-flex" />
            {(heading || trail) && (
                <div className="ml-3 min-w-0 flex-1">
                    {trail ? (
                        <PageHeadingTrail trail={trail} />
                    ) : heading ? (
                        <h1 className="truncate text-base font-bold xl:text-lg">{heading.title}</h1>
                    ) : null}
                </div>
            )}
            <div className="ml-auto flex min-w-0 shrink-0 items-center">
                {identity ? (
                    <p className="hidden min-w-0 max-w-[40vw] truncate px-3 text-xs text-muted-foreground sm:block">{identity}</p>
                ) : null}
                <NotificationBell />
            </div>
        </header>
        {openMobile ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[60] flex justify-center md:hidden">
                <button
                    type="button"
                    onClick={toggleSidebar}
                    aria-label="Закрыть меню"
                    className="pointer-events-auto flex size-14 items-center justify-center rounded-full border border-border/70 bg-background/80 shadow-lg backdrop-blur-md"
                >
                    <X className="size-6" />
                </button>
            </div>
        ) : null}
        </>
    );
}
