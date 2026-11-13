"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAccess } from "@/hooks/useAccess";

const ACCESS_PAGE = /^\/rrs\/[^/]+\/access\/?$/;

export function RrsSectionGate({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const access = useAccess();
    const known = Boolean(access.roleName) || access.conflict;
    if (!known || access.has("baskets:connect")) {
        return children;
    }
    if (access.has("branch.grants:write") && (pathname === "/rrs" || ACCESS_PAGE.test(pathname))) {
        return children;
    }
    return (
        <p className="text-sm text-muted-foreground">
            Этот раздел открывается с правом настройки корзин. Выдача доступа управляющим находится в карточке вашей РРС.
        </p>
    );
}
