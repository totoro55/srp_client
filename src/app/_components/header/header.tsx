'use client'

import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { getPageHeading } from "@/lib/routes-config";
import { useAccess } from "@/hooks/useAccess";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeadingTrail, usePageHeadingTrail } from "@/app/_components/header/page-heading";

function MobileMenuButton() {
    const { toggleSidebar, openMobile } = useSidebar();

    return (
        <div className={cn(
            "pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex justify-center md:hidden",
            openMobile ? "z-[60]" : "z-40"
        )}>
            <button
                type="button"
                onClick={toggleSidebar}
                aria-label={openMobile ? "Закрыть меню" : "Открыть меню"}
                className="pointer-events-auto flex size-14 items-center justify-center rounded-full border border-border/70 bg-background/80 shadow-lg backdrop-blur-md"
            >
                {openMobile ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
        </div>
    );
}

export default function Header() {
    const pathname = usePathname();
    const heading = getPageHeading(pathname);
    const trail = usePageHeadingTrail();
    const access = useAccess();
    const identity = access.roleName ? `${access.roleName} · ${access.scopeLabel}` : access.scopeLabel;

    return (
        <>
        <header className="flex h-16 w-full min-w-0 shrink-0 flex-row items-center justify-start border-b px-3">
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
            {identity ? (
                <p className="ml-2 hidden min-w-0 max-w-[40%] shrink truncate px-3 text-xs text-muted-foreground sm:block">{identity}</p>
            ) : null}
        </header>
        <MobileMenuButton />
        </>
    );
}
