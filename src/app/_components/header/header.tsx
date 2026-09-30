'use client'

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { usePathname } from "next/navigation";
import { getPageHeading } from "@/lib/routes-config";
import { useAccess } from "@/hooks/useAccess";

export default function Header() {
    const pathname = usePathname();
    const heading = getPageHeading(pathname);
    const access = useAccess();
    const identity = access.roleName ? `${access.roleName} · ${access.scopeLabel}` : access.scopeLabel;

    return (
        <header className="flex w-full shrink-0 flex-row items-center justify-start border-b p-1.5 xl:p-3">
            <SidebarTrigger />
            {heading && (
                <>
                    <Separator orientation="vertical" className="mx-1.5 h-6 xl:mx-3" />
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-bold xl:text-lg">{heading.title}</h1>
                        {heading.description && (
                            <p className="hidden truncate text-xs text-muted-foreground sm:block">
                                {heading.description}
                            </p>
                        )}
                    </div>
                </>
            )}
            {identity ? (
                <p className="ml-auto truncate px-3 text-xs text-muted-foreground">{identity}</p>
            ) : null}
        </header>
    );
}
